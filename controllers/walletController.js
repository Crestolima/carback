const Wallet = require('../models/Wallet');

const { v4: uuidv4 } = require('uuid');

const addFunds = async (req, res, next) => {
  try {
    const { userId, amount, cardNumber, expiryDate, cvv } = req.body;

    // Mock payment gateway validation
    if (cardNumber.length !== 16 || cvv.length !== 3) {
      return res.status(400).json({ message: 'Invalid card details' });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      type: 'credit',
      amount,
      description: `Fund added via mock gateway (Transaction ID: ${uuidv4()})`
    });

    await wallet.save();
    res.status(200).json({ message: 'Funds added successfully', balance: wallet.balance });
  } catch (error) {
    next(error);
  }
};

const namePayment = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    wallet.balance -= amount;
    wallet.transactions.push({
      type: 'debit',
      amount,
      description
    });

    await wallet.save();
    res.status(200).json({ message: 'Payment successful', balance: wallet.balance });
  } catch (error) {
    next(error);
  }
};

// Add this new controller function
const getWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      // If wallet doesn't exist, create a new one
      wallet = new Wallet({ 
        userId, 
        balance: 0, 
        transactions: [] 
      });
      await wallet.save();
    }
    
    res.status(200).json({
      balance: wallet.balance,
      transactions: wallet.transactions
    });
  } catch (error) {
    next(error);
  }
};

const calculateBookingPayments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    // Filter transactions that are booking payments
    const bookingPayments = wallet.transactions.filter(transaction => 
      transaction.type === 'credit' && 
      transaction.description.includes('Received payment for booking')
    );
    
    // Calculate total amount from booking payments
    const totalBookingAmount = bookingPayments.reduce((total, transaction) => 
      total + transaction.amount, 0
    );
    
    // Count the number of booking transactions
    const bookingCount = bookingPayments.length;
    
    res.status(200).json({
      totalBookingAmount,
      bookingCount,
      bookingPayments
    });
    
  } catch (error) {
    next(error);
  }
};

module.exports = { addFunds, namePayment ,getWallet,calculateBookingPayments};
