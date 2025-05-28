import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import { toast } from 'react-toastify';
import QRCode from 'qrcode.react';

const CORESCAN_TX_BASE = "https://scan.coredao.org/tx/";

const BalanceSection = ({ coreBalance, wallet, transactions }) => {
  const [corePrice, setCorePrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    // Fetch CORE price from Coingecko
    const fetchCorePrice = async () => {
      try {
        const resp = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=coredaoorg&vs_currencies=usd"
        );
        setCorePrice(resp.data?.coredaoorg?.usd || 0);
      } catch {
        setCorePrice(0);
      }
    };
    fetchCorePrice();
  }, []);

  const handleSend = () => {
    setShowSendModal(true);
  };

  const handleSendSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (!ethers.isAddress(sendAddress)) {
        throw new Error('Invalid address');
      }
      const amountWei = ethers.parseEther(sendAmount);
      const provider = new ethers.JsonRpcProvider('https://rpc.coredao.org');
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const balanceWei = await provider.getBalance(wallet.address);
      if (balanceWei < amountWei) {
        throw new Error('Insufficient CORE balance');
      }
      const feeData = await provider.getFeeData();
      const gasLimit = 21000n;
      const tx = await signer.sendTransaction({
        to: sendAddress,
        value: amountWei,
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      const receipt = await tx.wait();

      setShowSendModal(false);
      setSendAddress('');
      setSendAmount('');
      setSuccessData({
        hash: receipt.hash,
        from: wallet.address,
        to: sendAddress,
        amount: sendAmount,
        symbol: "CORE",
      });
      setShowSuccess(true);
      toast.success(`Sent ${sendAmount} CORE!`);
    } catch (error) {
      console.error('Send error:', error);
      toast.error(error.message || 'Failed to send CORE');
    }
    setIsLoading(false);
  };

  const handleReceive = () => {
    setShowReceiveModal(true);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    toast.success('Address copied to clipboard!');
  };

  // Show proper formatting for price and balances
  const formattedCore = coreBalance ? Number(coreBalance).toFixed(4) : "0.0000";
  const formattedTotalUSD =
    corePrice && coreBalance
      ? (Number(coreBalance) * Number(corePrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg mb-8 w-full relative z-10">
      <h2 className="text-accent text-2xl font-bold mb-4">Wallet Balance</h2>
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div>
          <p className="text-text text-lg">
            Total Balance: <span className="text-accent">${formattedTotalUSD}</span>
          </p>
          <p className="text-text">
            CORE: {formattedCore}
          </p>
        </div>
        <div className="flex space-x-4 mt-4 md:mt-0">
          <button
            onClick={handleSend}
            className="bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
          >
            Send
          </button>
          <button
            onClick={handleReceive}
            className="bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
          >
            Receive
          </button>
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-secondary p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-accent text-xl font-bold mb-4">Send CORE</h3>
            <div className="mb-4">
              <label className="block text-text mb-2">Recipient Address</label>
              <input
                type="text"
                className="w-full p-2.5 bg-text text-primary rounded-md"
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value)}
                placeholder="Enter recipient address"
                disabled={isLoading}
              />
            </div>
            <div className="mb-4">
              <label className="block text-text mb-2">Amount (CORE)</label>
              <input
                type="number"
                className="w-full p-2.5 bg-text text-primary rounded-md"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.0001"
                disabled={isLoading}
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleSendSubmit}
                className={`bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark ${
                  isLoading || !sendAddress || !sendAmount ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isLoading || !sendAddress || !sendAmount}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => setShowSendModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-secondary p-6 rounded-lg shadow-lg text-center w-full max-w-md">
            <h3 className="text-accent text-xl font-bold mb-4">Receive CORE</h3>
            <div className="bg-white p-4 rounded-md inline-block">
              <QRCode value={wallet.address} size={200} />
            </div>
            <p className="text-text mt-4 mb-2">Wallet Address:</p>
            <p
              className="text-text font-mono break-all cursor-pointer hover:text-accent"
              onClick={copyAddress}
            >
              {wallet.address}
            </p>
            <button
              onClick={() => setShowReceiveModal(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && successData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowSuccess(false);
            setSuccessData(null);
          }}
        >
          <div
            className="bg-secondary p-6 rounded-lg shadow-lg text-center w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-green-500 text-xl font-bold mb-4">Send Successful!</h3>
            <div className="mb-2 font-mono text-xs break-all">
              <span className="font-bold text-text">Tx Hash:</span> {successData.hash}
            </div>
            <div className="mb-2 font-mono text-xs break-all">
              <span className="font-bold text-text">From:</span> {successData.from}
            </div>
            <div className="mb-2 font-mono text-xs break-all">
              <span className="font-bold text-text">To:</span> {successData.to}
            </div>
            <div className="mb-2 font-mono text-xs">
              <span className="font-bold text-text">Token:</span> {successData.symbol}
              &nbsp;&nbsp;
              <span className="font-bold text-text">Amount:</span> {successData.amount}
            </div>
            <a
              href={CORESCAN_TX_BASE + successData.hash}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-accent text-primary px-4 py-2 rounded hover:bg-accent-dark mt-4"
            >
              View on Scan
            </a>
            <div className="mt-4">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                onClick={() => {
                  setShowSuccess(false);
                  setSuccessData(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BalanceSection;