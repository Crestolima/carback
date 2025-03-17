const Payment = require('../models/Payment');

exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, paymentMethod } = req.body;
    const payment = new Payment({
      userId,
      amount,
      paymentMethod,
      status: 'completed',
    });

    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};