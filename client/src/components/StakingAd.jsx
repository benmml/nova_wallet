import React, { useState } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CORE_RPC_URL, PULSE_CONTRACT_ADDRESS, PULSE_ABI, TOKEN_ADDRESSES } from '../config';

const ERC20_ABI = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

const StakingAd = ({ wallet }) => {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('CORE'); // Default to CORE
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ amount: '', token: '' });

  const navigate = useNavigate();

  const handleStake = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(CORE_RPC_URL);
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const contract = new ethers.Contract(PULSE_CONTRACT_ADDRESS, PULSE_ABI, signer);

      const feeData = await provider.getFeeData();
      if (token === 'CORE') {
        const amountWei = ethers.parseEther(amount);
        const tx = await contract.stakeCore({
          value: amountWei,
          gasLimit: 200000,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        const receipt = await tx.wait();
        toast.success(`Staked ${amount} CORE! Hash: ${receipt.hash}`);
        setSuccessInfo({ amount, token: 'CORE' });
        setShowSuccessPopup(true);
      } else if (token === 'USDT') {
        const tokenAddress = TOKEN_ADDRESSES[token];
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

        const amountWei = ethers.parseUnits(amount, 6);

        // Optional: check USDT balance
        const balanceWei = await tokenContract.balanceOf(wallet.address);
        if (balanceWei < amountWei) {
          throw new Error(`Insufficient USDT balance`);
        }

        // Approve USDT for staking
        const allowance = await tokenContract.allowance(wallet.address, PULSE_CONTRACT_ADDRESS);
        if (allowance < amountWei) {
          const approveTx = await tokenContract.approve(PULSE_CONTRACT_ADDRESS, amountWei);
          await approveTx.wait();
          toast.info(`Approved ${amount} USDT for staking`);
        }

        // Stake USDT
        const tx = await contract.stakeUsdt(amountWei, {
          gasLimit: 200000,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        const receipt = await tx.wait();
        toast.success(`Staked ${amount} USDT! Hash: ${receipt.hash}`);
        setSuccessInfo({ amount, token: 'USDT' });
        setShowSuccessPopup(true);
      }

      setAmount('');
      setShowForm(false);
    } catch (error) {
      console.error('Stake error:', error);
      const errorMessage = error.reason || error.message || 'Failed to stake tokens';
      toast.error(errorMessage);
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg">
      {/* Success Stake Popup */}
      {showSuccessPopup && (
        <div className="fixed z-50 inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center min-w-[260px] max-w-xs">
            <div className="text-2xl font-bold text-green-700 mb-3">Stake Successful!</div>
            <div className="text-lg mb-3">
              You have staked <b>{successInfo.amount} {successInfo.token}</b>
            </div>
            <div className="text-xl font-bold text-accent mb-4">
              You can now claim <span className="text-green-700">{(parseFloat(successInfo.amount) * 0.01).toFixed(4)} {successInfo.token}</span> daily!
            </div>
            <button
              className="w-full bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
              onClick={() => setShowSuccessPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {!showForm ? (
        <>
          <h2 className="text-accent text-xl font-bold mb-4">Start Staking</h2>
          <p className="text-text mb-4">Stake and earn 1% of your stake daily, withdrawable daily.</p>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
            >
              Stake Now
            </button>
            <button
              onClick={() => navigate('/staking')}
              className="w-full bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
            >
              View Stakes
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-accent text-xl font-bold mb-4">Stake Tokens</h2>
          <div className="mb-4">
            <label className="block text-text mb-2">Token</label>
            <select
              className="w-full p-2.5 bg-text text-primary rounded-md"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            >
              <option value="CORE">CORE</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-text mb-2">Amount</label>
            <input
              type="number"
              className="w-full p-2.5 bg-text text-primary rounded-md"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to stake"
              min="0"
              step="0.0001"
              disabled={isLoading}
            />
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleStake}
              className={`w-full bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark ${
                isLoading || !amount ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading || !amount}
            >
              {isLoading ? 'Staking...' : 'Stake Now'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StakingAd;