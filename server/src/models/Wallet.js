const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true },
  privateKey: { type: String },
  mnemonic: { type: String },
  referrer: { type: String, lowercase: true }, // Added for referral rewards
  createdAt: { type: Date, default: Date.now },
  isNew: { type: Boolean, default: false }
});

module.exports = mongoose.model('Wallet', walletSchema);