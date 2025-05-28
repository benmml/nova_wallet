const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const walletRoutes = require('./routes/wallet');
// Add the new CoreDAO proxy route
const coredaoRoutes = require('./routes/coredao');
const { connectDB, PORT, MONGO_URI } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/wallet', walletRoutes);
// Register the new proxy route
app.use('/api/coredao', coredaoRoutes);

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});