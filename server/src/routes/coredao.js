const express = require('express');
const axios = require('axios');
const router = express.Router();

// Load environment variables
require('dotenv').config();
const COREDDAO_API_KEY = process.env.COREDDAO_API_KEY;

// Note: The double slashes '//' are intentionally kept as required by CoreDAO API

// Proxy for ERC20 transfer events
router.get('/erc20-transfers/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const url = `https://openapi.coredao.org//api/accounts/list_of_erc20_transfer_events_by_address/${address}`;
    const response = await axios.get(url, {
      headers: { 'x-api-key': COREDDAO_API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// Proxy for CORE balance (native coin balance)
router.get('/core-balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const url = `https://openapi.coredao.org//api/accounts/core_balance_by_address/${address}`;
    const response = await axios.get(url, {
      headers: { 'x-api-key': COREDDAO_API_KEY }
    });
    // Always return balance as string for frontend compatibility
    const balance = response.data?.data?.balance
      ? response.data.data.balance.toString()
      : "0";
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// Proxy for latest CORE price
router.get('/core-price', async (req, res) => {
  try {
    const url = `https://openapi.coredao.org//api/stats/last_core_price`;
    const response = await axios.get(url, {
      headers: { 'x-api-key': COREDDAO_API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

module.exports = router;