import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 bg-primary z-10 shadow-lg">
        <div className="container flex justify-between items-center py-5">
          <div className="logo">
            <h1 className="text-accent text-3xl font-bold">Pulse Wallet</h1>
          </div>
          <nav className="space-x-6">
            <Link to="/import" className="text-text font-semibold hover:text-accent transition">Import Wallet</Link>
          </nav>
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center bg-gradient-to-b from-secondary to-primary">
        <div className="text-center">
          <img src={logo} alt="Pulse Wallet" className="w-full max-w-2xl mx-auto rounded-lg mb-6" />
          <h2 className="text-accent text-4xl font-bold mb-4">Welcome to Pulse Wallet</h2>
          <p className="text-text text-lg max-w-md mx-auto mb-8">
            Securely manage your CORE and PulseToken assets with ease.
          </p>
          <Link to="/import" className="button">Get Started</Link>
        </div>
      </main>
    </div>
  );
};

export default Home;