require('dotenv').config();

const mongoose = require('mongoose');

// Database connection function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nova-wallet', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = {
  API_URL: process.env.API_URL || 'http://localhost:5000/api',
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
  COINGECKO_API: 'https://api.coingecko.com/api/v3',
  NOVA_CONTRACT_ADDRESS: process.env.NOVA_CONTRACT_ADDRESS || '0xYourNovaTokenAddressHere',
  NOVA_ABI: require('./abi/nova-abi.json'), // Make sure to provide the ABI file at ./abi/nova-abi.json
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || '',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/nova-wallet',
  PORT: process.env.PORT || 5000,
  BSCSCAN_API: process.env.BSCSCAN_API || 'https://api.bscscan.com/api',
  connectDB, // Export the function
  // Example token addresses for BSC, update as needed:
  TOKEN_ADDRESSES: {
    BNB: '0x0000000000000000000000000000000000000000',
    WBNB: process.env.WBNB_ADDRESS || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: process.env.USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
    NOVA: process.env.NOVA_CONTRACT_ADDRESS || '0xYourNovaTokenAddressHere'
  }
};