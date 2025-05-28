const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const walletRoutes = require('./routes/bsc-wallet'); // Use BSC/Nova wallet routes
const bscRoutes = require('./routes/bsc'); // Use BSC proxy routes
const { connectDB, PORT, MONGO_URI } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/wallet', walletRoutes);
app.use('/api/bsc', bscRoutes);

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});