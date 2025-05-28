require('dotenv').config();

const mongoose = require('mongoose');

// Database connection function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pulse-wallet', {
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
  CORE_RPC_URL: process.env.CORE_RPC_URL || 'https://rpc.coredao.org',
  COINGECKO_API: 'https://api.coingecko.com/api/v3',
  PULSE_CONTRACT_ADDRESS: process.env.PULSE_CONTRACT_ADDRESS || '0x9d0714497318CDE8F285b51f1f896aE88e26a52F',
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || '',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/pulse-wallet',
  PORT: process.env.PORT || 5000,
  connectDB, // Export the function
};