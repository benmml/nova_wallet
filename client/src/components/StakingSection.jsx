import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  BSC_RPC_URL,
  NOVA_CONTRACT_ADDRESS,
  NOVA_ABI,
  TOKEN_ADDRESSES,
} from '../config';

const ERC20_ABI = [
  'function approve(address spender, uint256 value) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];
const ZERO_ADDRESS = TOKEN_ADDRESSES.BNB;
const USDT_ADDRESS = TOKEN_ADDRESSES.USDT;
const UNLOCK_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const CLAIM_PERIOD = 24 * 60 * 60 * 1000; // 24 hours in ms

const StakingSection = ({ wallet }) => {
  const [bnbStaked, setBnbStaked] = useState('0.0000');
  const [usdtStaked, setUsdtStaked] = useState('0.0000');
  const [bnbRewards, setBnbRewards] = useState('0.0000');
  const [usdtRewards, setUsdtRewards] = useState('0.0000');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeToken, setStakeToken] = useState('BNB');
  const [isLoading, setIsLoading] = useState(false);

  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimDialogContent, setClaimDialogContent] = useState('');
  const [claimDialogAction, setClaimDialogAction] = useState(null);

  const [showUnstakeDialog, setShowUnstakeDialog] = useState(false);
  const [unstakeDialogContent, setUnstakeDialogContent] = useState('');
  const [unstakeDialogAction, setUnstakeDialogAction] = useState(null);

  const [lastClaimOrStake, setLastClaimOrStake] = useState({ BNB: null, USDT: null });
  const [lastClaim, setLastClaim] = useState({ BNB: null, USDT: null });
  const [now, setNow] = useState(Date.now());

  // Success modal state
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState({ amount: '', token: '' });

  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- FETCH MY CONTRACT STAKES ---
  const fetchMyStakes = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
      const contract = new ethers.Contract(NOVA_CONTRACT_ADDRESS, NOVA_ABI, provider);

      // Get stake and reward balances
      const bnbStakedWei = await contract.getStake(wallet.address, ZERO_ADDRESS);
      const usdtStakedWei = await contract.getStake(wallet.address, USDT_ADDRESS);
      const bnbRewardsWei = await contract.getStakingRewards(wallet.address, ZERO_ADDRESS);
      const usdtRewardsWei = await contract.getStakingRewards(wallet.address, USDT_ADDRESS);

      setBnbStaked(ethers.formatEther(bnbStakedWei));
      setUsdtStaked(ethers.formatUnits(usdtStakedWei, 18)); // BSC USDT is 18 decimals by default
      setBnbRewards(ethers.formatEther(bnbRewardsWei));
      setUsdtRewards(ethers.formatUnits(usdtRewardsWei, 18));

      const bnbLast = Number(await contract.stakeTimestampsCore(wallet.address)) * 1000;
      const usdtLast = Number(await contract.stakeTimestampsUsdt(wallet.address)) * 1000;

      let bnbLastClaim = 0, usdtLastClaim = 0;
      if (contract.getLastClaimTimestamp) {
        bnbLastClaim = Number(await contract.getLastClaimTimestamp(wallet.address, ZERO_ADDRESS)) * 1000;
        usdtLastClaim = Number(await contract.getLastClaimTimestamp(wallet.address, USDT_ADDRESS)) * 1000;
      }
      setLastClaimOrStake({ BNB: bnbLast, USDT: usdtLast });
      setLastClaim({ BNB: bnbLastClaim, USDT: usdtLastClaim });
    } catch (error) {
      toast.error('Failed to load staking data. Please check your contract address and ABI.');
      setBnbStaked('0.0000');
      setUsdtStaked('0.0000');
      setBnbRewards('0.0000');
      setUsdtRewards('0.0000');
      setLastClaimOrStake({ BNB: null, USDT: null });
      setLastClaim({ BNB: null, USDT: null });
    }
  };

  useEffect(() => {
    if (wallet?.address) fetchMyStakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]);

  const formatCountdown = (msLeft) => {
    if (msLeft <= 0) return 'now';
    const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((msLeft / (60 * 60 * 1000)) % 24);
    const mins = Math.floor((msLeft / (60 * 1000)) % 60);
    const secs = Math.floor((msLeft / 1000) % 60);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  };

  // Staking
  const handleStake = async () => {
    if (isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0) return;
    setIsLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const contract = new ethers.Contract(NOVA_CONTRACT_ADDRESS, NOVA_ABI, signer);

      const feeData = await provider.getFeeData();
      let tx;
      if (stakeToken === 'BNB') {
        tx = await contract.stakeCore({
          value: ethers.parseEther(stakeAmount),
          gasLimit: 200000,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
      } else {
        const tokenContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
        const stakeValue = ethers.parseUnits(stakeAmount, 18);
        const allowance = await tokenContract.allowance(wallet.address, NOVA_CONTRACT_ADDRESS);
        if (allowance < stakeValue) {
          const approveTx = await tokenContract.approve(NOVA_CONTRACT_ADDRESS, stakeValue);
          await approveTx.wait();
        }
        tx = await contract.stakeUsdt(stakeValue, {
          gasLimit: 200000,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
      }
      const receipt = await tx.wait();
      toast.success(`Staked ${stakeAmount} ${stakeToken}! Hash: ${receipt.hash}`);
      setStakeAmount('');
      fetchMyStakes();
      setSuccessData({
        amount: stakeAmount,
        token: stakeToken,
      });
      setShowSuccessPopup(true);
    } catch (error) {
      let reason = error?.reason || error?.data?.message || error?.message || 'Failed to stake';
      if (error.code === 'CALL_EXCEPTION' && !error.reason) {
        reason = 'Contract call reverted. Please check the contract and your parameters.';
      }
      toast.error(`Stake error: ${reason}`);
      console.error('Stake error:', error);
    }
    setIsLoading(false);
  };

  const handleClaimRewards = (token, staked, reward, lastStakeOrClaim, lastClaimed) => {
    if (parseFloat(staked) === 0) {
      setClaimDialogContent(`You must stake ${token} before you can claim rewards.`);
      setClaimDialogAction(null);
      setShowClaimDialog(true);
      return;
    }
    if (!lastStakeOrClaim) {
      setClaimDialogContent('Loading data. Please try again shortly.');
      setClaimDialogAction(null);
      setShowClaimDialog(true);
      return;
    }
    const sinceLastStake = now - lastStakeOrClaim;
    const sinceLastClaim = now - (lastClaimed || 0);
    if (sinceLastStake < CLAIM_PERIOD) {
      const msLeft = CLAIM_PERIOD - sinceLastStake;
      setClaimDialogContent(
        `Claiming will be available ${formatCountdown(msLeft)} after your last stake or claim.`
      );
      setClaimDialogAction(null);
      setShowClaimDialog(true);
      return;
    }
    if (sinceLastClaim < CLAIM_PERIOD) {
      setClaimDialogContent(
        `Already claimed for today. You can claim again in ${formatCountdown(CLAIM_PERIOD - sinceLastClaim)}.`
      );
      setClaimDialogAction(null);
      setShowClaimDialog(true);
      return;
    }
    if (parseFloat(reward) === 0) {
      setClaimDialogContent(`There are no ${token} rewards to claim right now. Try again later.`);
      setClaimDialogAction(null);
      setShowClaimDialog(true);
      return;
    }
    setClaimDialogContent(
      <>
        <div className="mb-2 font-semibold">
          Claim your <span className="text-green-700">{parseFloat(reward).toFixed(4)} {token}</span> daily reward?
        </div>
      </>
    );
    setClaimDialogAction(() => async () => {
      setShowClaimDialog(false);
      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        const contract = new ethers.Contract(NOVA_CONTRACT_ADDRESS, NOVA_ABI, signer);
        const tokenAddress = token === 'BNB' ? ZERO_ADDRESS : USDT_ADDRESS;
        const feeData = await provider.getFeeData();
        const tx = await contract.claimRewards(tokenAddress, {
          gasLimit: 200000,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        await tx.wait();
        toast.success(`Claimed ${token} rewards!`);
        fetchMyStakes();
      } catch (error) {
        toast.error(error.reason || error.message || 'Failed to claim rewards');
      }
      setIsLoading(false);
    });
    setShowClaimDialog(true);
  };

  const handleUnstake = (token, staked, lastAction) => {
    if (parseFloat(staked) === 0) {
      setUnstakeDialogContent(`You have no ${token} staked to unstake.`);
      setUnstakeDialogAction(null);
      setShowUnstakeDialog(true);
      return;
    }
    if (!lastAction || lastAction === 0) {
      setUnstakeDialogContent('Please stake first.');
      setUnstakeDialogAction(null);
      setShowUnstakeDialog(true);
      return;
    }
    const unlockTime = lastAction + UNLOCK_PERIOD;
    const msLeft = unlockTime - now;
    if (msLeft > 0) {
      setUnstakeDialogContent(
        `Unstaking is only available 30 days after your last stake or claim. Please wait ${formatCountdown(msLeft)}.`
      );
      setUnstakeDialogAction(null);
      setShowUnstakeDialog(true);
      return;
    }
    setUnstakeDialogContent(
      <>
        <div className="mb-2 font-semibold">
          Unstake <span className="text-red-700">{parseFloat(staked).toFixed(4)} {token}</span>?
        </div>
      </>
    );
    setUnstakeDialogAction(() => async () => {
      setShowUnstakeDialog(false);
      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        const contract = new ethers.Contract(NOVA_CONTRACT_ADDRESS, NOVA_ABI, signer);
        const tokenAddress = token === 'BNB' ? ZERO_ADDRESS : USDT_ADDRESS;
        const tx = await contract.unstake(tokenAddress, {
          gasLimit: 200000,
        });
        await tx.wait();
        toast.success(`Unstaked ${token} successfully!`);
        fetchMyStakes();
      } catch (error) {
        toast.error(error.reason || error.message || 'Failed to unstake');
      }
      setIsLoading(false);
    });
    setShowUnstakeDialog(true);
  };

  const handleReturnToDashboard = () => {
    navigate('/dashboard');
  };

  const dailyReward = (amt) => (parseFloat(amt || 0) * 0.01).toFixed(4);

  const buttonClass = (color, disabled) =>
    `w-full py-2 px-4 rounded transition font-semibold shadow-sm ${
      color === 'accent'
        ? 'bg-gradient-to-r from-blue-500 to-accent text-white hover:from-accent hover:to-blue-500'
        : color === 'green'
        ? 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-700 hover:to-green-500'
        : color === 'red'
        ? 'bg-gradient-to-r from-red-500 to-red-700 text-white hover:from-red-700 hover:to-red-500'
        : color === 'gray'
        ? 'bg-gray-500 text-white hover:bg-gray-700'
        : 'bg-primary text-white'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg max-w-2xl mx-auto relative">
      {/* Return */}
      <button
        className={`${buttonClass('gray', false)} absolute top-4 right-4 w-auto`}
        onClick={handleReturnToDashboard}
        type="button"
      >
        ← Back to Dashboard
      </button>
      <h2 className="text-accent text-2xl font-bold mb-3">Staking</h2>
      <div className="mb-5 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded text-yellow-900 font-semibold shadow">
        <span className="text-lg">🚀 Earn <b>1% daily</b> by staking BNB or USDT with us!</span>
        <br />
        <span className="text-sm">All new stakes from this page go to our 1% daily contract.</span>
      </div>
      <div className="mb-8 bg-primary rounded-lg p-4 shadow">
        <h3 className="font-bold text-text text-lg mb-2">Your Stakes (1% Daily Contract)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
          {/* BNB */}
          <div>
            <div className="text-xs text-gray-500">BNB Staked</div>
            <div className="font-bold">{bnbStaked}</div>
            <div className="text-xs text-green-700 mt-1">
              Daily: {dailyReward(bnbStaked)} BNB
            </div>
            <button
              className={buttonClass('red', isLoading)}
              style={{ marginTop: 8 }}
              disabled={isLoading}
              onClick={() => handleUnstake('BNB', bnbStaked, lastClaimOrStake.BNB)}
              type="button"
            >
              Unstake BNB
            </button>
          </div>
          {/* USDT */}
          <div>
            <div className="text-xs text-gray-500">USDT Staked</div>
            <div className="font-bold">{usdtStaked}</div>
            <div className="text-xs text-green-700 mt-1">
              Daily: {dailyReward(usdtStaked)} USDT
            </div>
            <button
              className={buttonClass('red', isLoading)}
              style={{ marginTop: 8 }}
              disabled={isLoading}
              onClick={() => handleUnstake('USDT', usdtStaked, lastClaimOrStake.USDT)}
              type="button"
            >
              Unstake USDT
            </button>
          </div>
          {/* BNB Rewards */}
          <div>
            <div className="text-xs text-gray-500">BNB Rewards</div>
            <div className="font-bold">{bnbRewards}</div>
            <button
              className={buttonClass('green', isLoading)}
              style={{ marginTop: 8 }}
              disabled={isLoading}
              onClick={() =>
                handleClaimRewards(
                  'BNB',
                  bnbStaked,
                  bnbRewards,
                  lastClaimOrStake.BNB,
                  lastClaim.BNB
                )
              }
              type="button"
            >
              Claim BNB Rewards
            </button>
          </div>
          {/* USDT Rewards */}
          <div>
            <div className="text-xs text-gray-500">USDT Rewards</div>
            <div className="font-bold">{usdtRewards}</div>
            <button
              className={buttonClass('green', isLoading)}
              style={{ marginTop: 8 }}
              disabled={isLoading}
              onClick={() =>
                handleClaimRewards(
                  'USDT',
                  usdtStaked,
                  usdtRewards,
                  lastClaimOrStake.USDT,
                  lastClaim.USDT
                )
              }
              type="button"
            >
              Claim USDT Rewards
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <select
            className="p-2 bg-text text-primary rounded-md"
            value={stakeToken}
            onChange={(e) => setStakeToken(e.target.value)}
            disabled={isLoading}
          >
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
          </select>
          <input
            type="number"
            className="p-2 bg-text text-primary rounded-md w-36"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder={`Amount (${stakeToken})`}
            disabled={isLoading}
            min="0"
            step="any"
          />
          <button
            onClick={handleStake}
            className={buttonClass('accent', isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0)}
            disabled={isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0}
            type="button"
          >
            {isLoading ? 'Staking...' : 'Stake'}
          </button>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white p-8 rounded-lg shadow-xl min-w-[260px] max-w-xs text-center">
            <div className="text-2xl font-bold text-green-700 mb-3">Stake Successful!</div>
            <div className="text-lg mb-3">
              You have staked <b>{successData.amount} {successData.token}</b>
            </div>
            <div className="text-xl font-bold text-accent mb-4">
              You can now claim <span className="text-green-700">{dailyReward(successData.amount)} {successData.token}</span> daily!
            </div>
            <button
              className={buttonClass('accent', false)}
              style={{ marginTop: 8 }}
              onClick={() => setShowSuccessPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Claim Dialog */}
      {showClaimDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-lg shadow-xl min-w-[260px] max-w-xs text-center">
            <div>{claimDialogContent}</div>
            {claimDialogAction && (
              <button
                className={buttonClass('green', false)}
                style={{ marginTop: 8 }}
                onClick={claimDialogAction}
                disabled={isLoading}
              >
                {isLoading ? 'Claiming...' : 'Yes, Claim Now'}
              </button>
            )}
            <button
              className={buttonClass('gray', false)}
              style={{ marginTop: 16 }}
              onClick={() => setShowClaimDialog(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showUnstakeDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-lg shadow-xl min-w-[260px] max-w-xs text-center">
            <div>{unstakeDialogContent}</div>
            {unstakeDialogAction && (
              <button
                className={buttonClass('red', false)}
                style={{ marginTop: 8 }}
                onClick={unstakeDialogAction}
                disabled={isLoading}
              >
                {isLoading ? 'Unstaking...' : 'Yes, Unstake'}
              </button>
            )}
            <button
              className={buttonClass('gray', false)}
              style={{ marginTop: 16 }}
              onClick={() => setShowUnstakeDialog(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakingSection;