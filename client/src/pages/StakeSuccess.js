import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const StakeSuccess = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { amount, token } = state || {};

  if (!amount) {
    // If landed here without state, redirect to staking page
    navigate('/stake', { replace: true });
    return null;
  }

  const dailyReward = (parseFloat(amount) * 0.01).toFixed(4);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary">
      <div className="bg-white rounded-lg p-8 shadow-md text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-3">Staked Successfully!</h1>
        <p className="text-lg mb-2">
          <b>{amount}</b> {token} has been staked.
        </p>
        <p className="text-md mb-4">
          You can now claim <span className="font-bold">{dailyReward} {token}</span> daily (1% of your staked amount).
        </p>
        <button
          className="bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
          onClick={() => navigate('/dashboard')}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default StakeSuccess;