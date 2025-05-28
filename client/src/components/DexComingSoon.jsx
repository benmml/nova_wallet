import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Set the DEX launch date (UTC)
const launchDate = new Date('2025-07-01T00:00:00Z');
// Set Pulse token price in USD
const PULSE_USDT_PRICE = 0.1;
const PULSE_BTC_PRICE = "0.00000155"; // example (0.1/64500)
const PULSE_ETH_PRICE = "0.000032";   // example (0.1/3150)

function getTimeRemaining(endTime) {
  const total = endTime - new Date();
  const seconds = Math.max(Math.floor((total / 1000) % 60), 0);
  const minutes = Math.max(Math.floor((total / 1000 / 60) % 60), 0);
  const hours = Math.max(Math.floor((total / (1000 * 60 * 60)) % 24), 0);
  const days = Math.max(Math.floor(total / (1000 * 60 * 60 * 24)), 0);
  return { total, days, hours, minutes, seconds };
}

export default function DexComingSoon() {
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(launchDate));
  const [corePrice, setCorePrice] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeRemaining(launchDate)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch real CORE price from CoinGecko
    async function fetchCorePrice() {
      try {
        const resp = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=coredaoorg&vs_currencies=usd"
        );
        setCorePrice(resp.data?.coredaoorg?.usd || 0);
      } catch {
        setCorePrice(0);
      }
    }
    fetchCorePrice();
    // Optionally, refresh every 60 seconds
    const ref = setInterval(fetchCorePrice, 60000);
    return () => clearInterval(ref);
  }, []);

  // If price is loading, show placeholder
  const coreUsdtPriceStr = corePrice === null ? "..." : Number(corePrice).toFixed(4);

  // Compute PULSE/CORE based on real price
  const pulseCorePriceStr =
    corePrice && corePrice > 0
      ? (PULSE_USDT_PRICE / corePrice).toFixed(6)
      : "...";

  // DEX pairs and prices
  const fakePairs = [
    { pair: "CORE/USDT", price: coreUsdtPriceStr, change: "+0.9%" },
    { pair: "PULSE/CORE", price: pulseCorePriceStr, change: "+0.0%" },
    { pair: "PULSE/USDT", price: PULSE_USDT_PRICE.toFixed(4), change: "+0.0%" },
    { pair: "PULSE/BTC", price: PULSE_BTC_PRICE, change: "+0.0%" },
    { pair: "PULSE/ETH", price: PULSE_ETH_PRICE, change: "+0.0%" },
  ];

  return (
    <div className="relative overflow-hidden bg-primary border border-accent rounded-xl shadow-xl p-0 mb-6 flex flex-col items-center min-h-[420px]">
      {/* DEX Styled Background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 70% 30%, rgba(64,0,120,0.21) 0, rgba(26,42,68,0.7) 40%)," +
            "linear-gradient(120deg, rgba(24,36,57,0.96) 70%, rgba(60,12,120,0.16) 100%)",
        }}
      />
      {/* Decorative DEX grid lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        viewBox="0 0 600 400"
        fill="none"
        style={{ zIndex: 1 }}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b3b58" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* DEX Title & Countdown */}
      <div className="relative z-10 w-full flex flex-col items-center py-6 px-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-accent drop-shadow mb-2 text-center tracking-tight">
          <span className="inline-block align-middle mr-2">🔄</span>
          PulseZone DEX Launch
        </h1>
        <div className="w-full flex flex-col items-center mb-4">
          <div className="flex space-x-3 text-2xl md:text-3xl font-mono font-bold text-accent drop-shadow-lg my-2">
            <span>
              {String(timeLeft.days).padStart(2, "0")}
              <span className="block text-xs font-normal text-text/80">days</span>
            </span>
            <span>:</span>
            <span>
              {String(timeLeft.hours).padStart(2, "0")}
              <span className="block text-xs font-normal text-text/80">hrs</span>
            </span>
            <span>:</span>
            <span>
              {String(timeLeft.minutes).padStart(2, "0")}
              <span className="block text-xs font-normal text-text/80">min</span>
            </span>
            <span>:</span>
            <span>
              {String(timeLeft.seconds).padStart(2, "0")}
              <span className="block text-xs font-normal text-text/80">sec</span>
            </span>
          </div>
        </div>
        <div className="text-text text-base text-center font-semibold mb-2">
          <span className="block md:inline">
            <span className="text-accent font-bold">Professional trading</span> coming live on <span className="font-bold text-accent">July 1, 2025</span>.
          </span>
        </div>
        <div className="rounded bg-accent/10 border border-accent px-4 py-2 mt-2 text-accent text-sm font-medium text-center max-w-lg">
          Trading of <span className="font-bold">Pulse token</span> will begin as soon as the DEX opens.
        </div>
      </div>
      {/* Fake DEX Table */}
      <div className="relative z-10 w-full px-4 pb-6">
        <div className="max-w-lg mx-auto bg-primary/80 rounded-lg shadow-lg border border-accent/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-accent/30">
            <span className="text-text font-bold text-lg tracking-tight">Markets</span>
            <span className="text-accent font-mono text-xs">Preview</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-accent uppercase border-b border-accent/30">
                <th className="px-4 py-2">Pair</th>
                <th className="px-4 py-2">Last Price</th>
                <th className="px-4 py-2">24h Change</th>
              </tr>
            </thead>
            <tbody>
              {fakePairs.map((row, idx) => (
                <tr key={row.pair}
                  className={`text-text font-mono ${idx % 2 === 0 ? "bg-primary/90" : "bg-primary/80"} hover:bg-accent/5 transition`}>
                  <td className="px-4 py-2 font-bold">{row.pair}</td>
                  <td className="px-4 py-2">{row.price}</td>
                  <td className={`px-4 py-2 font-semibold ${row.change.startsWith('+') ? "text-green-400" : "text-red-400"}`}>{row.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
        <div className="bg-black/60 rounded-xl px-8 py-4 flex flex-col items-center shadow-2xl">
          <span className="text-accent text-3xl md:text-4xl font-extrabold tracking-wide mb-2 animate-pulse">
            Coming Soon
          </span>
          <span className="text-text/70 text-md md:text-lg font-medium">
            The DEX is under construction. Stay tuned!
          </span>
        </div>
      </div>
    </div>
  );
}