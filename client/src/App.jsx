import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WalletDashboard from './pages/WalletDashboard';
import WalletImport from './pages/WalletImport';
import Welcome from './pages/Welcome';
import StakingSection from './components/StakingSection';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// EntryPoint component to handle root redirect logic
const EntryPoint = ({ setWallet }) => {
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const selectedWallet = localStorage.getItem('selectedWallet');
    const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
    const foundWallet = wallets.find((w) => w.address === selectedWallet);
    if (selectedWallet && foundWallet) {
      setWallet(foundWallet); // <-- Ensure wallet state is up to date
      setShouldRedirect(true);
    }
  }, [setWallet]);

  if (shouldRedirect) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Welcome setWallet={setWallet} />;
};

const App = () => {
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    const selectedWallet = localStorage.getItem('selectedWallet');
    if (selectedWallet) {
      const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
      const foundWallet = wallets.find((w) => w.address === selectedWallet);
      if (foundWallet) {
        setWallet(foundWallet);
      }
    }
  }, []);

  const selectWallet = (address) => {
    const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
    const foundWallet = wallets.find((w) => w.address === address);
    if (foundWallet) {
      setWallet(foundWallet);
      localStorage.setItem('selectedWallet', address);
    }
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<EntryPoint setWallet={setWallet} />}
        />
        <Route
          path="/dashboard"
          element={
            wallet ? (
              <WalletDashboard />
            ) : (
              <Navigate to="/import" />
            )
          }
        />
        <Route
          path="/import"
          element={<WalletImport setWallet={setWallet} />}
        />
        <Route
          path="/staking"
          element={wallet ? <StakingSection wallet={wallet} /> : <Navigate to="/import" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;