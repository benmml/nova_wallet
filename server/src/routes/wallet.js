const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const { ethers } = require('ethers');
const { PULSE_CONTRACT_ADDRESS, PULSE_ABI, CORE_SCAN_API, ADMIN_PRIVATE_KEY } = require('../config');
const axios = require('axios');

router.post('/import', async (req, res) => {
  try {
    console.log('Received import payload:', req.body);
    // Accept "created" from frontend for identifying new wallets
    const { address, privateKey, mnemonic, referrer, created } = req.body;

    if (!address || (!privateKey && !mnemonic)) {
      return res.status(400).json({ message: 'Address and either privateKey or mnemonic are required' });
    }

    let wallet;
    try {
      if (privateKey) {
        wallet = new ethers.Wallet(privateKey);
      } else {
        wallet = ethers.Wallet.fromPhrase(mnemonic);
      }
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ message: 'Address does not match the provided key or mnemonic' });
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid private key or mnemonic' });
    }

    const existingWallet = await Wallet.findOne({ address: address.toLowerCase() });
    if (existingWallet) {
      return res.status(200).json({ message: 'Wallet already exists', address });
    }

    // Save isNew flag if provided, else false
    const newWallet = new Wallet({
      address: address.toLowerCase(),
      privateKey: privateKey || undefined,
      mnemonic,
      referrer: referrer || null,
      isNew: !!created, // <--- this line marks a newly created wallet
    });

    await newWallet.save();
    console.log('Wallet stored in MongoDB:', address);
    res.status(200).json({ message: 'Wallet imported successfully', address });
  } catch (error) {
    console.error('Error importing wallet:', error);
    res.status(500).json({ message: 'Server error during wallet import' });
  }
});

router.post('/sign-claim', async (req, res) => {
  try {
    const { address } = req.body;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    const provider = new ethers.JsonRpcProvider('https://rpc.coredao.org');
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(PULSE_CONTRACT_ADDRESS, PULSE_ABI, provider);

    // Check claim status
    const isClaimed = await contract.hasClaimed(address);
    if (isClaimed) {
      return res.status(400).json({ message: 'Tokens already claimed' });
    }

    // Get claimable amount
    const amount = await contract.getClaimableAmount(address);
    if (amount === 0n) {
      return res.status(400).json({ message: 'No tokens to claim' });
    }

    // Fetch referrer
    const wallet = await Wallet.findOne({ address: address.toLowerCase() });
    const referrer = wallet?.referrer || ethers.ZeroAddress;

    // Generate nonce
    const nonce = Date.now();

    // Create message hash for claimTokens
    const claimMessageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'address', 'uint256'],
        [address, amount, referrer, nonce]
      )
    );
    // Sign message hash
    const adminSig = await adminWallet.signMessage(
      ethers.utils ? ethers.utils.arrayify(claimMessageHash) : ethers.getBytes(claimMessageHash)
    );

    // Fetch transaction count via Core Scan API
    const txResponse = await axios.get(
      `${CORE_SCAN_API}?module=account&action=txlist&address=${address}`
    );
    if (txResponse.data.status !== '1') {
      return res.status(500).json({ message: 'Failed to fetch transaction count' });
    }
    const txCount = txResponse.data.result.length;

    // Set transaction count
    const setTxMessageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256'],
        [address, txCount, nonce]
      )
    );
    const setTxAdminSig = await adminWallet.signMessage(
      ethers.utils ? ethers.utils.arrayify(setTxMessageHash) : ethers.getBytes(setTxMessageHash)
    );

    const setTx = await contract.connect(adminWallet).setTransactionCount(address, txCount, nonce, setTxAdminSig);
    await setTx.wait();

    res.status(200).json({
      amount,
      nonce,
      adminSig,
      claimable: ethers.formatEther(amount),
      messageHash: claimMessageHash,
    });
  } catch (error) {
    console.error('Error signing claim transaction:', error);
    res.status(500).json({ message: error.reason || error.message || 'Failed to sign claim transaction' });
  }
});

router.get('/credentials/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    const wallet = await Wallet.findOne({ address: address.toLowerCase() });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json({
      privateKey: wallet.privateKey || null,
      mnemonic: wallet.mnemonic || null,
    });
  } catch (error) {
    console.error('Error retrieving wallet credentials:', error);
    res.status(500).json({ message: 'Server error retrieving wallet credentials' });
  }
});

router.delete('/delete/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    const wallet = await Wallet.findOneAndDelete({ address: address.toLowerCase() });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ message: 'Server error deleting wallet' });
  }
});

module.exports = router;