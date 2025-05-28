const express = require('express');
const axios = require('axios');
const router = express.Router();

// Load environment variables
require('dotenv').config();
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY; // Use BscScan API for BSC explorer data

// Proxy for ERC20 transfer events (BscScan)
router.get('/erc20-transfers/:address', async (req, res) => {
  try {
    const { address } = req.params;
    // See https://docs.bscscan.com/api-endpoints/accounts#get-erc20-token-transfer-events-by-address
    const url = `https://api.bscscan.com/api?module=account&action=tokentx&address=${address}&sort=desc&apikey=${BSCSCAN_API_KEY}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// Proxy for BNB balance (native coin balance)
router.get('/bnb-balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    // https://docs.bscscan.com/api-endpoints/accounts#get-bnb-balance-for-a-single-address
    const url = `https://api.bscscan.com/api?module=account&action=balance&address=${address}&apikey=${BSCSCAN_API_KEY}`;
    const response = await axios.get(url);
    // Always return balance as string for frontend compatibility
    const balance = response.data?.result ? response.data.result.toString() : "0";
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// Proxy for latest BNB price
router.get('/bnb-price', async (req, res) => {
  try {
    // Use CoinGecko for price data as BscScan may not provide price directly
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd";
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

module.exports = router;