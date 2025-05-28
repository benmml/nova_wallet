import React, { useState, useEffect } from 'react';
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  getBytes,
  keccak256,
  formatEther,
  formatUnits,
  solidityPacked,
  parseEther,
} from 'ethers';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import BalanceSection from '../components/BalanceSection';
import TokenList from '../components/TokenList';
import StakingAd from '../components/StakingAd';
import DexComingSoon from '../components/DexComingSoon';
import ReferralSection from '../components/ReferralSection';
import {
  CORE_RPC_URL,
  COINGECKO_API,
  TOKEN_ADDRESSES,
  PULSE_CONTRACT_ADDRESS,
  PULSE_ABI,
} from '../config';

const CLAIM_END_BLOCK = 24683011;
const CLAIM_THRESHOLD = 10;

const cardClass =
  'bg-primary/95 rounded-xl shadow-xl p-6 mb-6 border border-accent';
const btnClass =
  'inline-block px-6 py-2 rounded-lg font-bold text-lg transition bg-accent text-primary shadow-lg hover:bg-accent-dark hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed';
const sectionTitleClass =
  'flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-accent mb-3 tracking-tight';
const labelClass = 'block text-text font-semibold text-sm mb-1';
const valueClass = 'text-2xl font-mono text-text';

const WalletDashboard = () => {
  const [wallet, setWallet] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [coreBalance, setCoreBalance] = useState('0');
  const [pulseBalance, setPulseBalance] = useState('0');
  const [totalBalanceUSD, setTotalBalanceUSD] = useState('0.00');
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState(0);
  const [claimableAmount, setClaimableAmount] = useState('0');
  const [loading, setLoading] = useState(true);

  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [claimSuccessData, setClaimSuccessData] = useState({
    amount: '',
    token: 'PULSE',
  });

  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimedInitial, setHasClaimedInitial] = useState(false);

  const [appTxCount, setAppTxCount] = useState(0);
  const [pulseAppEarnings, setPulseAppEarnings] = useState(0);

  // Referral logic state
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralStep, setReferralStep] = useState(0); // 0 = closed, 1 = choose, 2 = input
  const [referrerInput, setReferrerInput] = useState('');
  const [referrerSaved, setReferrerSaved] = useState('');
  const [referralError, setReferralError] = useState('');

  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [showDeleteWalletModal, setShowDeleteWalletModal] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  function patchWallet(w) {
    if (!w) return null;
    if ((!w.privateKey || w.privateKey === '') && w.mnemonic) {
      try {
        const reconstructed = Wallet.fromPhrase(w.mnemonic);
        return {
          ...w,
          privateKey: reconstructed.privateKey,
        };
      } catch (e) {
        return w;
      }
    }
    return w;
  }

  useEffect(() => {
    const storedWalletsRaw = JSON.parse(localStorage.getItem('wallets') || '[]');
    const patchedWallets = storedWalletsRaw.map(patchWallet);
    if (
      patchedWallets.length === storedWalletsRaw.length &&
      JSON.stringify(patchedWallets) !== JSON.stringify(storedWalletsRaw)
    ) {
      localStorage.setItem('wallets', JSON.stringify(patchedWallets));
    }

    let selectedAddress = localStorage.getItem('selectedWallet') || '';
    let selectedWallet = patchedWallets.find(
      (w) => w.address.toLowerCase() === selectedAddress.toLowerCase()
    );

    if (!selectedWallet && patchedWallets.length > 0) {
      selectedAddress = patchedWallets[0].address;
      localStorage.setItem('selectedWallet', selectedAddress);
      selectedWallet = patchedWallets[0];
    }

    if (
      selectedWallet &&
      (!selectedWallet.privateKey || selectedWallet.privateKey === '') &&
      selectedWallet.mnemonic
    ) {
      try {
        const reconstructed = Wallet.fromPhrase(selectedWallet.mnemonic);
        selectedWallet.privateKey = reconstructed.privateKey;
        const updatedWallets = patchedWallets.map(w =>
          w.address.toLowerCase() === selectedWallet.address.toLowerCase()
            ? { ...w, privateKey: reconstructed.privateKey }
            : w
        );
        localStorage.setItem('wallets', JSON.stringify(updatedWallets));
      } catch (e) {
        const filtered = patchedWallets.filter(
          w => w.address.toLowerCase() !== selectedWallet.address.toLowerCase()
        );
        localStorage.setItem('wallets', JSON.stringify(filtered));
        toast.error('Corrupted wallet entry removed. Please re-import.');
        setLoading(false);
        navigate('/import', { replace: true });
        return;
      }
    }

    if (selectedWallet) {
      setWallet(selectedWallet);
      setWallets(patchedWallets);
      localStorage.setItem('selectedWallet', selectedWallet.address);
      fetchData(selectedWallet);
    } else {
      setLoading(false);
      toast.warn('No wallet found, redirecting to import');
      navigate('/import', { replace: true });
    }
    // eslint-disable-next-line
  }, [navigate, location.state?.refreshBalances]);

  const fetchData = async (selectedWallet) => {
    setLoading(true);
    try {
      const provider = new JsonRpcProvider(CORE_RPC_URL);

      const coreBalanceWei = await provider.getBalance(selectedWallet.address);
      setCoreBalance(parseFloat(formatEther(coreBalanceWei)).toFixed(4));

      let pulseBalanceEth = '0';
      try {
        const pulseContract = new Contract(
          PULSE_CONTRACT_ADDRESS,
          [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
          ],
          provider
        );
        const [bal, decimals] = await Promise.all([
          pulseContract.balanceOf(selectedWallet.address),
          pulseContract.decimals().catch(() => 18),
        ]);
        pulseBalanceEth = formatUnits(bal, decimals);
        setPulseBalance(Number(pulseBalanceEth).toFixed(4));
      } catch (error) {
        setPulseBalance('0.0000');
      }

      const tokenBalances = await Promise.all(
        Object.entries(TOKEN_ADDRESSES)
          .filter(([name]) => name !== 'CORE' && name !== 'PULSE')
          .map(async ([name, address]) => {
            let attempts = 3;
            while (attempts > 0) {
              try {
                const erc20Abi = [
                  'function balanceOf(address) view returns (uint256)',
                  'function decimals() view returns (uint8)',
                ];
                const contract = new Contract(address, erc20Abi, provider);
                const [bal, decimals] = await Promise.all([
                  contract.balanceOf(selectedWallet.address),
                  contract.decimals().catch(() => (name === 'USDT' ? 6 : 18)),
                ]);
                const balance = parseFloat(formatUnits(bal, decimals));
                return { name, address, balance: balance.toFixed(4) };
              } catch (error) {
                attempts--;
                if (attempts === 0) {
                  return { name, address, balance: '0.0000' };
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          })
      );

      let corePrice = 0.8;
      let wcorePrice = 0.8;
      let usdtPrice = 1.0;
      try {
        const response = await axios.get(
          `${COINGECKO_API}/simple/price?ids=coredaoorg,wrapped-core,tether&vs_currencies=usd`
        );
        const prices = response.data;
        corePrice = prices.coredaoorg?.usd || corePrice;
        wcorePrice = prices['wrapped-core']?.usd || wcorePrice;
        usdtPrice = prices.tether?.usd || usdtPrice;
      } catch (error) {}

      const coreUSD = parseFloat(coreBalanceWei ? formatEther(coreBalanceWei) : '0') * corePrice;
      const pulseUSD = parseFloat(pulseBalanceEth) * corePrice;
      const tokenUSD = tokenBalances.reduce((sum, token) => {
        const price =
          token.name === 'WCORE'
            ? wcorePrice
            : token.name === 'USDT'
            ? usdtPrice
            : 0;
        return sum + parseFloat(token.balance) * price;
      }, 0);
      setTotalBalanceUSD((coreUSD + pulseUSD + tokenUSD).toFixed(2));
      setTokens(tokenBalances);

      const pulseContract = new Contract(PULSE_CONTRACT_ADDRESS, PULSE_ABI, provider);
      const claimed = await pulseContract.hasClaimed(selectedWallet.address);
      setHasClaimedInitial(claimed);

      try {
        const txCount = await provider.getTransactionCount(selectedWallet.address, 'latest');
        setTransactions(txCount);
        setClaimableAmount((txCount * 1).toFixed(2));
      } catch (chainError) {
        console.error('Failed to fetch transaction count from blockchain:', chainError);
        toast.error('Unable to fetch transaction count');
      }

      let joinTxKey = `pulse_join_tx_${selectedWallet.address}`;
      let appTxStart = parseInt(localStorage.getItem(joinTxKey) || '0', 10);
      if (appTxStart === 0 && claimed) {
        const currentTxCount = await provider.getTransactionCount(selectedWallet.address, 'latest');
        localStorage.setItem(joinTxKey, currentTxCount);
        appTxStart = currentTxCount;
      }
      if (claimed) {
        const currentTxCount = await provider.getTransactionCount(selectedWallet.address, 'latest');
        const appTx = Math.max(0, currentTxCount - appTxStart);
        setAppTxCount(appTx);
        setPulseAppEarnings(appTx);
      } else {
        setAppTxCount(0);
        setPulseAppEarnings(0);
      }
    } catch (error) {
      toast.error(error.reason || error.message || 'Failed to load dashboard data');
    }
    setLoading(false);
  };

  // --- Referral Modal logic ---
  const openReferralStep = () => {
    setReferralStep(1); // Step 1: choose
    setShowReferralModal(true);
    setReferralError('');
    setReferrerInput('');
  };

  const handleReferralNone = () => {
    setReferrerSaved('0x0000000000000000000000000000000000000000');
    setShowReferralModal(false);
    setReferralStep(0);
    setReferralError('');
    setReferrerInput('');
    handleClaim('0x0000000000000000000000000000000000000000');
  };

  const handleReferralYes = () => {
    setReferralStep(2); // Step 2: input
    setReferralError('');
    setReferrerInput('');
  };

  const handleReferralSubmit = () => {
    const addr = referrerInput.trim();
    if (!addr) {
      setReferralError('Referral address required or choose No Referral.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setReferralError('Wrong or invalid address.');
      return;
    }
    if (wallet && addr.toLowerCase() === wallet.address.toLowerCase()) {
      setReferralError('You cannot refer yourself.');
      return;
    }
    setReferralError('');
    setReferrerSaved(addr);
    setShowReferralModal(false);
    setReferralStep(0);
    handleClaim(addr);
  };

  // handleClaim now takes an optional referrer param
  const handleClaim = async (_referrer) => {
    if (parseFloat(claimableAmount) === 0) {
      toast.warn('No claimable amount available');
      return;
    }
    setIsClaiming(true);
    try {
      const provider = new JsonRpcProvider(CORE_RPC_URL);
      const signer = new Wallet(wallet.privateKey, provider);
      const contract = new Contract(PULSE_CONTRACT_ADDRESS, PULSE_ABI, signer);

      const referrer =
        typeof _referrer === 'string'
          ? _referrer
          : referrerSaved || '0x0000000000000000000000000000000000000000';

      const amountToClaim = parseEther(claimableAmount);
      const nonce = Date.now() + Math.floor(Math.random() * 10000);

      // Debug log for outgoing payload
      console.log('Claim POST payload:', {
        address: wallet.address,
        amount: amountToClaim.toString(),
        referrer,
        nonce,
      });

      const response = await axios.post(
        'https://pulse-wallet-7lxb.onrender.com/api/wallet/sign-claim',
        {
          address: wallet.address,
          amount: amountToClaim.toString(),
          referrer,
          nonce,
        }
      );

      // Debug log for backend response
      console.log('Backend response:', response.data);

      const adminSig = response.data.signature;
      if (!adminSig) {
        toast.error('Failed to obtain admin signature');
        setIsClaiming(false);
        return;
      }

      const packed = solidityPacked(
        ['address', 'uint256', 'address', 'uint256'],
        [wallet.address, amountToClaim, referrer, nonce]
      );
      const messageHash = keccak256(packed);
      const userSig = await signer.signMessage(getBytes(messageHash));

      const tx = await contract.claimTokens(
        wallet.address,
        amountToClaim,
        referrer,
        nonce,
        adminSig,
        userSig,
        { gasLimit: 200000 }
      );
      await tx.wait();
      setClaimSuccessData({ amount: claimableAmount, token: 'PULSE' });
      setShowClaimSuccess(true);
      toast.success('Tokens claimed successfully!');
      setClaimableAmount('0');
      const currentTxCount = await provider.getTransactionCount(
        wallet.address,
        'latest'
      );
      localStorage.setItem(
        `pulse_join_tx_${wallet.address}`,
        currentTxCount
      );
      setHasClaimedInitial(true);
      fetchData(wallet);
    } catch (error) {
      if (error.response) {
        console.error('Backend response error:', error.response.data);
        toast.error(
          error.response.data.error ||
            error.response.data.message ||
            'Failed to claim tokens'
        );
      } else {
        console.error('Claim error:', error);
        toast.error(
          error.reason || error.message || 'Failed to claim tokens'
        );
      }
    }
    setIsClaiming(false);
  };

  const selectWallet = (address) => {
    const selectedWallet = wallets.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
    if (selectedWallet) {
      setWallet(selectedWallet);
      localStorage.setItem('selectedWallet', address);
      fetchData(selectedWallet);
    } else {
      setWallet(null);
      localStorage.removeItem('selectedWallet');
      navigate('/import', { replace: true });
    }
  };

  // ADD WALLET: Show confirmation modal before navigating to import
  const handleAddWallet = async () => {
    setShowAddWalletModal(true);
  };

  // Confirm add wallet: go to import page
  const confirmAddWallet = () => {
    setShowAddWalletModal(false);
    navigate('/import', { state: { fromDashboard: true } });
  };

  // Cancel add wallet modal
  const cancelAddWallet = () => {
    setShowAddWalletModal(false);
  };

  // Show confirmation modal before deleting wallet
  const handleDeleteWallet = async (addressToDelete) => {
    setWalletToDelete(addressToDelete);
    setShowDeleteWalletModal(true);
  };

  // Confirm actual deletion
  const confirmDeleteWallet = async () => {
    const addressToDelete = walletToDelete;
    setShowDeleteWalletModal(false);

    const storedWallets = JSON.parse(localStorage.getItem('wallets') || '[]');
    const updatedWallets = storedWallets.filter(
      (w) => w.address.toLowerCase() !== addressToDelete.toLowerCase()
    );
    localStorage.setItem('wallets', JSON.stringify(updatedWallets));

    let selectedAddress = localStorage.getItem('selectedWallet') || '';
    if (selectedAddress.toLowerCase() === addressToDelete.toLowerCase()) {
      if (updatedWallets.length > 0) {
        localStorage.setItem('selectedWallet', updatedWallets[0].address);
        setWallet(updatedWallets[0]);
        fetchData(updatedWallets[0]);
      } else {
        localStorage.removeItem('selectedWallet');
        setWallet(null);
        setWallets([]);
        navigate('/import', { replace: true });
        return;
      }
    }
    setWallets(updatedWallets);
    setWalletToDelete(null);
    toast.success('Wallet deleted from this device.');
  };

  // Cancel delete action
  const cancelDeleteWallet = () => {
    setShowDeleteWalletModal(false);
    setWalletToDelete(null);
  };

  // If coming from import page, show a back-to-dashboard button
  const showBackButton =
    location.state && location.state.fromImport === true;

  // When on import page, set fromDashboard state so Import page can use it for back navigation
  useEffect(() => {
    if (
      location.pathname === '/import' &&
      location.state &&
      location.state.fromDashboard !== true
    ) {
      navigate('/import', { state: { fromDashboard: true } });
    }
    // eslint-disable-next-line
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text bg-primary">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-accent mb-4"></div>
          <span className="text-lg font-semibold text-text">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary p-6 font-sans">
      {/* Add Wallet Confirmation Modal */}
      {showAddWalletModal && (
        <div className="fixed z-50 inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white/90 p-8 rounded-2xl shadow-2xl text-center min-w-[260px] max-w-xs border border-accent">
            <div className="text-2xl font-extrabold text-accent mb-3">Add New Wallet</div>
            <div className="mb-4 text-gray-900">
              Are you sure you want to add a new wallet? <br />You can always switch between wallets.
            </div>
            <div className="flex space-x-2">
              <button
                className={btnClass + " w-1/2"}
                onClick={confirmAddWallet}
              >
                Yes, Add Wallet
              </button>
              <button
                className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg w-1/2 font-bold"
                onClick={cancelAddWallet}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Wallet Confirmation Modal */}
      {showDeleteWalletModal && (
        <div className="fixed z-50 inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white/90 p-8 rounded-2xl shadow-2xl text-center min-w-[260px] max-w-xs border border-red-400">
            <div className="text-2xl font-extrabold text-red-600 mb-3">Delete Wallet</div>
            <div className="mb-4 text-gray-900">
              Are you sure you want to <span className="text-red-600 font-bold">permanently delete</span> this wallet from your device?
              <br />This action cannot be undone on this device. Your wallet will remain safe on the blockchain and in any backup you have.
            </div>
            <div className="flex space-x-2">
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-lg w-1/2 font-bold hover:bg-red-700"
                onClick={confirmDeleteWallet}
              >
                Yes, Delete
              </button>
              <button
                className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg w-1/2 font-bold"
                onClick={cancelDeleteWallet}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showClaimSuccess && (
        <div className="fixed z-50 inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white/90 p-8 rounded-2xl shadow-2xl text-center min-w-[260px] max-w-xs border border-green-400">
            <div className="text-4xl font-extrabold text-green-800 mb-3 text-shadow-md">
              ✅ Claim Successful!
            </div>
            <div className="text-xl font-bold text-gray-900 mb-4 text-shadow-sm">
              You have claimed{' '}
              <span className="text-accent font-extrabold">
                {claimSuccessData.amount} {claimSuccessData.token}
              </span>{' '}
              rewards!
            </div>
            <button
              className={btnClass + " w-full mt-2"}
              onClick={() => setShowClaimSuccess(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed z-50 inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white/90 p-6 rounded-xl shadow-2xl text-center min-w-[320px] max-w-xs border border-accent">
            {referralStep === 1 && (
              <>
                <h3 className="text-3xl font-extrabold text-accent mb-4 text-shadow-md">
                  Claim Referral
                </h3>
                <p className="mb-5 text-gray-900 text-base font-semibold text-shadow-sm">
                  Do you have a referral address? If yes, you'll get 10% bonus, and so will your referrer!
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleReferralYes}
                    className={btnClass + " w-1/2"}
                  >
                    I have a referral
                  </button>
                  <button
                    onClick={handleReferralNone}
                    className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg w-1/2 font-bold"
                  >
                    No referral
                  </button>
                </div>
              </>
            )}
            {referralStep === 2 && (
              <>
                <h3 className="text-3xl font-extrabold text-accent mb-3 text-shadow-md">
                  Enter Referral Address
                </h3>
                <p className="mb-3 text-gray-900 text-base font-semibold text-shadow-sm">
                  Enter a referral wallet address to gain a 10% bonus!
                </p>
                <input
                  className="w-full p-2 mb-3 border rounded focus:outline-none focus:ring-2 focus:ring-accent font-medium text-gray-900"
                  placeholder="0x..."
                  value={referrerInput}
                  onChange={e => setReferrerInput(e.target.value)}
                />
                {referralError && (
                  <div className="text-red-700 font-bold mb-3 text-shadow-sm">{referralError}</div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={handleReferralSubmit}
                    className={btnClass + " w-1/2"}
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => {
                      setShowReferralModal(false);
                      setReferralError('');
                      setReferralStep(0);
                      setReferrerInput('');
                    }}
                    className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg w-1/2 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-7">
        <h1 className="text-4xl md:text-5xl font-extrabold text-accent drop-shadow-lg mb-3 md:mb-0">
          PulseWallet Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <select
            className="p-2 bg-white border border-accent text-primary rounded-lg font-semibold shadow"
            value={wallet?.address || ''}
            onChange={(e) => selectWallet(e.target.value)}
          >
            <option value="">Select Wallet</option>
            {wallets.map((w) => (
              <option key={w.address} value={w.address}>
                {w.address.slice(0, 6)}...{w.address.slice(-4)}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddWallet}
            className={btnClass + " px-3 py-2 !text-base !font-semibold"}
          >
            Add Wallet
          </button>
          {wallet && (
            <button
              onClick={() => handleDeleteWallet(wallet.address)}
              className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 font-semibold"
            >
              Delete Wallet
            </button>
          )}
        </div>
      </header>

      {wallet ? (
        <>
          <div className={cardClass + " flex flex-col md:flex-row md:items-end gap-4"}>
            <BalanceSection
              coreBalance={coreBalance}
              pulseBalance={pulseBalance}
              wallet={wallet}
              transactions={transactions}
              totalBalanceUSD={totalBalanceUSD}
            />
          </div>
          {(!hasClaimedInitial) && (
            <div className={cardClass}>
              <div className={sectionTitleClass}><span>🎁</span> Initial Claimable Amount</div>
              <label className={labelClass}>Eligible Transactions:</label>
              <span className={valueClass}>{claimableAmount}</span>
              <span className="ml-2 text-accent font-bold">PULSE</span>
              {parseFloat(claimableAmount) === 0 && (
                <p className="text-red-500 text-sm mt-2 mb-2">No claimable tokens available. Make transactions to earn claimable tokens.</p>
              )}
              <button
                onClick={openReferralStep}
                className={btnClass + " mt-4 w-full"}
                disabled={isClaiming || parseFloat(claimableAmount) === 0}
              >
                {isClaiming ? 'Claiming...' : 'Claim Tokens'}
              </button>
              <div className="mt-3 text-xs text-text">
                After claiming, you'll start earning 1 PULSE for every transaction made on PulseWallet.
              </div>
            </div>
          )}
          {(hasClaimedInitial) && (
            <div className={cardClass}>
              <div className={sectionTitleClass}><span>🔥</span> PulseWallet Rewards</div>
              <div className="mb-2 text-text text-base">
                <b>Earn 1 PULSE for every transaction</b> performed with your wallet on the Pulse app!
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <div className={labelClass}>Claimable:</div>
                  <div className={valueClass}>{pulseAppEarnings}</div>
                  <span className="ml-2 text-accent font-bold">PULSE</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-text">
                Claiming would be available shortly before Pulse trading goes live.
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2">
              <div className={cardClass}><TokenList wallet={wallet} /></div>
            </div>
            <div className="md:w-1/2">
              <div className={cardClass}><StakingAd wallet={wallet} /></div>
            </div>
          </div>

          <div className={cardClass + " mt-6"}>
  <DexComingSoon />
</div>


          <div className={cardClass + " mt-6"}>
            <ReferralSection address={wallet.address} />
          </div>
        </>
      ) : (
        <div className={cardClass + " text-center"}>
          <p className="text-text font-semibold text-lg">
            No wallet selected. Please import or select a wallet.
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletDashboard;