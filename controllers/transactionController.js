// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');

const createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, amount, transactionType, description } = req.body;
    
    // Validate required fields
    if (!userId || !amount || !transactionType) {
      return res.status(400).json({ 
        message: 'Missing required fields: userId, amount, and transactionType are required' 
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Wallet not found for user' });
    }

    // Create new transaction
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      amount,
      transactionType,
      description: description || `${transactionType} transaction`,
      status: 'completed',
      date: new Date()
    });

    // Update wallet balance
    if (transactionType === 'debit') {
      if (wallet.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }
      wallet.balance -= amount;
    } else {
      wallet.balance += amount;
    }

    // Save both transaction and wallet changes
    await Promise.all([
      transaction.save({ session }),
      wallet.save({ session })
    ]);

    await session.commitTransaction();
    
    // Return success response
    return res.status(201).json({
      success: true,
      transaction,
      newBalance: wallet.balance
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Transaction creation error:', error);
    return res.status(500).json({ 
      message: 'Error creating transaction', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

module.exports = { createTransaction };