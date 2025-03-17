const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: String,
      date: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

// Create the Wallet model *after* defining the schema
const Wallet = mongoose.model('Wallet', walletSchema); // 'Wallet' is the collection name

module.exports = Wallet;