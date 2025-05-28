import React, { useState, useEffect } from "react";
import axios from "axios";
import { ethers } from "ethers";
import QRCode from "qrcode.react";
import { toast } from "react-toastify";
import {
  CORE_RPC_URL,
  TOKEN_ADDRESSES,
  PULSE_CONTRACT_ADDRESS,
  PULSE_ABI,
} from "../config";

const CORESCAN_TX_BASE = "https://scan.coredao.org/tx/";

const fetchTokenMetadata = async (address, provider) => {
  try {
    const abi = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ];
    const contract = new ethers.Contract(address, abi, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => "Unknown"),
      contract.symbol().catch(() => "UNKNOWN"),
      contract.decimals().catch(() => 18),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  } catch {
    return { name: "Unknown", symbol: "UNKNOWN", decimals: 18 };
  }
};

const TokenList = ({ wallet }) => {
  const [coreBalance, setCoreBalance] = useState(0);
  const [corePrice, setCorePrice] = useState(0);
  const [pulseBalance, setPulseBalance] = useState(0);
  const [otherTokens, setOtherTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [showAddToken, setShowAddToken] = useState(false);
  const [tokenUpdateTrigger, setTokenUpdateTrigger] = useState(0);

  // Modal state
  const [modalToken, setModalToken] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(""); // "send" or "receive"
  // Send form state
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Refresh balances function
  const fetchAllTokens = async () => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(CORE_RPC_URL);

      // Fetch Core (native) balance
      let fetchedCoreBalance = 0;
      try {
        const balanceWei = await provider.getBalance(wallet.address);
        fetchedCoreBalance = parseFloat(ethers.formatEther(balanceWei));
      } catch {
        fetchedCoreBalance = 0;
      }
      setCoreBalance(fetchedCoreBalance);

      // Fetch Core price from Coingecko
      let fetchedCorePrice = 0;
      try {
        const resp = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=coredaoorg&vs_currencies=usd"
        );
        fetchedCorePrice = resp.data?.coredaoorg?.usd || 0;
      } catch {
        fetchedCorePrice = 0;
      }
      setCorePrice(fetchedCorePrice);

      // Fetch Pulse token balance (ERC-20 balanceOf)
      let fetchedPulseBalance = 0;
      try {
        const pulseContract = new ethers.Contract(
          PULSE_CONTRACT_ADDRESS,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
          ],
          provider
        );
        const [bal, decimals] = await Promise.all([
          pulseContract.balanceOf(wallet.address),
          pulseContract.decimals().catch(() => 18),
        ]);
        fetchedPulseBalance = Number(ethers.formatUnits(bal, decimals));
      } catch {
        fetchedPulseBalance = 0;
      }
      setPulseBalance(fetchedPulseBalance);

      // Other tokens: custom tokens (from localStorage) + optionally hardcoded
      const customTokens = JSON.parse(
        localStorage.getItem("customTokens") || "[]"
      );
      let tokenAddressesSet = new Set([
        ...customTokens.map((addr) => addr.toLowerCase()),
      ]);
      [
        TOKEN_ADDRESSES.WCORE,
        TOKEN_ADDRESSES.USDT,
      ].forEach((addr) => tokenAddressesSet.add(addr.toLowerCase()));

      let transferEvents = [];
      if (wallet?.address) {
        try {
          const resp = await axios.get(
            `/api/coredao/erc20-transfers/${wallet.address}`
          );
          transferEvents = Array.isArray(resp.data?.data)
            ? resp.data.data
            : [];
        } catch (error) {
          // Ignore errors for tokens
        }
      }
      transferEvents.forEach((ev) => {
        if (ev.contract_address) {
          tokenAddressesSet.add(ev.contract_address.toLowerCase());
        }
      });

      tokenAddressesSet.delete(""); // Remove empty string if any
      const tokenAddresses = Array.from(tokenAddressesSet);

      const _otherTokens = [];
      await Promise.all(
        tokenAddresses.map(async (address) => {
          address = address.toLowerCase();
          if (
            address === TOKEN_ADDRESSES.CORE?.toLowerCase() ||
            address === TOKEN_ADDRESSES.PULSE?.toLowerCase()
          ) {
            return;
          }
          const meta = await fetchTokenMetadata(address, provider);
          let balance = 0;
          try {
            const abi = [
              "function balanceOf(address) view returns (uint256)",
            ];
            const contract = new ethers.Contract(address, abi, provider);
            balance = Number(
              ethers.formatUnits(
                await contract.balanceOf(wallet.address),
                meta.decimals || 18
              )
            );
          } catch {
            balance = 0;
          }
          if (
            customTokens
              .map((x) => x.toLowerCase())
              .includes(address) ||
            Number(balance) > 0
          ) {
            _otherTokens.push({
              name: meta.name,
              symbol: meta.symbol,
              address,
              balance: Number(balance) || 0,
              decimals: meta.decimals,
            });
          }
        })
      );
      setOtherTokens(_otherTokens);
    } catch (error) {
      toast.error("Failed to fetch token list");
      setCoreBalance(0);
      setCorePrice(0);
      setPulseBalance(0);
      setOtherTokens([]);
    }
    setLoading(false);
  };

  // Refresh on mount, after send, and whenever wallet is open
  useEffect(() => {
    if (wallet?.address) {
      fetchAllTokens();
    }
    // eslint-disable-next-line
  }, [wallet, tokenUpdateTrigger]);

  // Also refresh when modal closes (user may expect update after sending or switching tokens)
  useEffect(() => {
    if (!showModal && !showSuccess) {
      fetchAllTokens();
    }
    // eslint-disable-next-line
  }, [showModal, showSuccess]);

  // Add custom token
  const handleAddToken = async () => {
    if (!customTokenAddress || !ethers.isAddress(customTokenAddress)) {
      toast.error("Please enter a valid token contract address");
      return;
    }
    const customTokens = JSON.parse(localStorage.getItem("customTokens") || "[]");
    if (
      customTokens
        .map((x) => x.toLowerCase())
        .includes(customTokenAddress.toLowerCase())
    ) {
      toast.warn("Token already added");
      return;
    }
    try {
      const provider = new ethers.JsonRpcProvider(CORE_RPC_URL);
      const meta = await fetchTokenMetadata(customTokenAddress, provider);
      if (meta.name === "Unknown" || meta.symbol === "UNKNOWN") {
        toast.error("Token contract not valid or not a standard ERC-20");
        return;
      }
      customTokens.push(customTokenAddress);
      localStorage.setItem("customTokens", JSON.stringify(customTokens));
      setCustomTokenAddress("");
      setShowAddToken(false);
      setTokenUpdateTrigger((x) => x + 1);
      toast.success(`Added ${meta.name} (${meta.symbol})`);
    } catch {
      toast.error("Token contract could not be added");
    }
  };

  // SEND function using saved wallet private key
  const handleSend = async () => {
    if (!wallet || !wallet.privateKey) {
      toast.error("Wallet not connected or missing private key.");
      return;
    }
    if (!ethers.isAddress(sendTo)) {
      toast.error("Invalid recipient address");
      return;
    }
    if (Number(sendAmount) <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    setSending(true);
    try {
      const provider = new ethers.JsonRpcProvider(CORE_RPC_URL);
      const signer = new ethers.Wallet(wallet.privateKey, provider);

      let tx, receipt, decimals, symbol, hash;
      if (modalToken.symbol === "CORE") {
        // Native CORE transfer
        const amountWei = ethers.parseEther(sendAmount);
        const balanceWei = await provider.getBalance(wallet.address);
        if (balanceWei < amountWei) {
          throw new Error("Insufficient CORE balance");
        }
        const feeData = await provider.getFeeData();
        const gasLimit = 21000n;
        tx = await signer.sendTransaction({
          to: sendTo,
          value: amountWei,
          gasLimit,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        receipt = await tx.wait();
        decimals = 18;
        symbol = "CORE";
        hash = receipt.hash;
      } else {
        // ERC-20 token transfer
        const erc20Abi = [
          "function transfer(address to, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)",
        ];
        const contract = new ethers.Contract(modalToken.address, erc20Abi, signer);
        decimals =
          modalToken.decimals ||
          (await contract.decimals().catch(() => 18));
        const amountParsed = ethers.parseUnits(sendAmount, decimals);
        const balance = await contract.balanceOf(wallet.address);
        if (balance < amountParsed) {
          throw new Error(`Insufficient ${modalToken.symbol} balance`);
        }
        tx = await contract.transfer(sendTo, amountParsed);
        receipt = await tx.wait();
        symbol = modalToken.symbol;
        hash = receipt.hash;
      }
      setShowModal(false);
      setSendTo("");
      setSendAmount("");
      setSuccessData({
        hash,
        from: wallet.address,
        to: sendTo,
        amount: sendAmount,
        symbol,
      });
      setShowSuccess(true);
      setTokenUpdateTrigger((x) => x + 1); // Refresh balances
    } catch (err) {
      toast.error("Send failed: " + (err?.reason || err?.message || err));
    }
    setSending(false);
  };

  // Helper for copying address
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied!");
  };

  if (loading) {
    return <div className="text-text">Loading tokens...</div>;
  }

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg mt-4 relative z-0">
      <h2 className="text-accent text-xl font-bold mb-4">Tokens</h2>
      <ul className="space-y-4">
        {/* CORE always shows, even if 0 */}
        <li
          className="flex justify-between text-text font-semibold cursor-pointer hover:bg-accent/30 rounded-lg px-2 py-1"
          onClick={() => {
            setModalToken({
              name: "Core",
              symbol: "CORE",
              balance: coreBalance,
              address: wallet.address,
              decimals: 18,
              isNative: true,
            });
            setModalAction("");
            setShowModal(true);
          }}
        >
          <span>Core (CORE)</span>
          <span>
            {coreBalance.toFixed(4)}
            {corePrice > 0
              ? ` (≈ $${(coreBalance * corePrice).toFixed(2)})`
              : ""}
          </span>
        </li>

        {/* Pulse always shows, even if 0 */}
        <li
          className="flex justify-between text-text font-semibold cursor-pointer hover:bg-accent/30 rounded-lg px-2 py-1"
          onClick={() => {
            setModalToken({
              name: "PulseToken",
              symbol: "PULSE",
              balance: pulseBalance,
              address: TOKEN_ADDRESSES.PULSE,
              decimals: 18,
            });
            setModalAction("");
            setShowModal(true);
          }}
        >
          <span>PulseToken (PULSE)</span>
          <span>{pulseBalance.toFixed(4)}</span>
        </li>

        {/* Other tokens, only if balance > 0 or custom */}
        {otherTokens.map((token) => (
          <li
            key={token.address}
            className="flex justify-between text-text cursor-pointer hover:bg-accent/30 rounded-lg px-2 py-1"
            onClick={() => {
              setModalToken(token);
              setModalAction("");
              setShowModal(true);
            }}
          >
            <span>
              {token.name} ({token.symbol})
            </span>
            <span>{token.balance.toFixed(4)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <button
          onClick={() => setShowAddToken(!showAddToken)}
          className="bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
        >
          {showAddToken ? "Cancel" : "Add Token"}
        </button>
        {showAddToken && (
          <div className="mt-2 flex items-center space-x-2">
            <input
              type="text"
              className="w-full p-2.5 bg-text text-primary rounded-md"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              placeholder="Enter token contract address"
            />
            <button
              onClick={handleAddToken}
              className="bg-accent text-primary px-4 py-2 rounded-md hover:bg-accent-dark"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Modal for Send/Receive */}
      {showModal && modalToken && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50"
          onClick={() => {
            setShowModal(false);
            setModalAction("");
          }}
        >
          <div
            className="bg-primary rounded-lg p-6 min-w-[300px] max-w-[95vw] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-accent"
              onClick={() => {
                setShowModal(false);
                setModalAction("");
              }}
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-2">
              {modalToken.name} ({modalToken.symbol})
            </h3>
            <div className="mb-2">
              <span className="font-mono">
                Balance: {modalToken.balance.toFixed(4)}
              </span>
            </div>
            {/* Only show buttons if not in send/receive mode */}
            {!modalAction && (
              <div className="flex space-x-4 mt-4">
                <button
                  className="px-4 py-2 bg-accent rounded-md text-primary"
                  onClick={() => {
                    setModalAction("send");
                    setSendTo("");
                    setSendAmount("");
                  }}
                >
                  Send
                </button>
                <button
                  className="px-4 py-2 bg-accent rounded-md text-primary"
                  onClick={() => setModalAction("receive")}
                >
                  Receive
                </button>
              </div>
            )}
            {/* Send UI */}
            {modalAction === "send" && (
              <div className="mt-4">
                <label className="block text-sm mb-1">Recipient Address</label>
                <input
                  className="w-full p-2 bg-secondary rounded mb-2"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="0x..."
                  disabled={sending}
                />
                <label className="block text-sm mb-1">Amount</label>
                <input
                  className="w-full p-2 bg-secondary rounded mb-2"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="any"
                  disabled={sending}
                />
                <div className="flex space-x-4 mt-2">
                  <button
                    className="bg-accent text-primary px-4 py-2 rounded hover:bg-accent-dark"
                    disabled={sending || !sendTo || !sendAmount}
                    onClick={handleSend}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    disabled={sending}
                    onClick={() => setModalAction("")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {/* Receive UI */}
            {modalAction === "receive" && (
              <div className="mt-4 flex flex-col items-center">
                <QRCode value={wallet.address} size={140} />
                <div className="mt-2 font-mono break-all text-center">
                  {wallet.address}
                </div>
                <button
                  className="bg-accent text-primary px-4 py-2 rounded mt-2 hover:bg-accent-dark"
                  onClick={() => copyToClipboard(wallet.address)}
                >
                  Copy Address
                </button>
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 mt-2"
                  onClick={() => setModalAction("")}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success modal */}
      {showSuccess && successData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50"
          onClick={() => {
            setShowSuccess(false);
            setSuccessData(null);
          }}
        >
          <div
            className="bg-primary rounded-lg p-6 min-w-[320px] max-w-[95vw] relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-accent"
              onClick={() => {
                setShowSuccess(false);
                setSuccessData(null);
              }}
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-3 text-green-500">Send Successful!</h3>
            <div className="mb-2">
              <span className="font-mono text-xs break-all">
                <span className="font-bold text-text">Tx Hash:</span> {successData.hash}
              </span>
            </div>
            <div className="mb-2">
              <span className="font-mono text-xs break-all">
                <span className="font-bold text-text">From:</span> {successData.from}
              </span>
            </div>
            <div className="mb-2">
              <span className="font-mono text-xs break-all">
                <span className="font-bold text-text">To:</span> {successData.to}
              </span>
            </div>
            <div className="mb-2">
              <span className="font-mono text-xs">
                <span className="font-bold text-text">Token:</span> {successData.symbol}

                <span className="font-bold text-text">Amount:</span> {successData.amount}
              </span>
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

export default TokenList;