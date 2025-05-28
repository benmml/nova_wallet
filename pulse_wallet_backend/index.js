require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());
app.use(cors());

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
if (!ADMIN_PRIVATE_KEY) {
  console.error('ADMIN_PRIVATE_KEY missing in .env');
  process.exit(1);
}

const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);

// Route for the claim signature (used by dashboard frontend)
app.post('/api/wallet/sign-claim', async (req, res) => {
  try {
    const { address, amount, referrer, nonce } = req.body;
    if (!address || !amount || !referrer || !nonce) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Recompute the packed hash exactly as it will be used on-chain
    const packed = ethers.solidityPacked(
      ['address', 'uint256', 'address', 'uint256'],
      [address, amount, referrer, nonce]
    );
    const messageHash = ethers.keccak256(packed);

    // Sign as Ethereum Signed Message (EIP-191)
    const signature = await adminWallet.signMessage(ethers.getBytes(messageHash));

    // Respond in the same format as your original system
    res.json({ signature });
  } catch (err) {
    console.error('Signature error:', err);
    res.status(500).json({ error: err.message });
  }
});

// (OPTIONAL) Keep this route for backward compatibility if your frontend ever uses it
app.post('/api/coredao/claim-signature', async (req, res) => {
  try {
    const { address, amount, referrer, nonce } = req.body;
    if (!address || !amount || !referrer || !nonce) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const packed = ethers.solidityPacked(
      ['address', 'uint256', 'address', 'uint256'],
      [address, amount, referrer, nonce]
    );
    const messageHash = ethers.keccak256(packed);
    const signature = await adminWallet.signMessage(ethers.getBytes(messageHash));

    res.json({ signature });
  } catch (err) {
    console.error('Signature error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});