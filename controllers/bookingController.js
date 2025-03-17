const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Car = require('../models/Car');
const User = require('../models/User');
const mongoose = require('mongoose');

// New function to update booking status to inProgress on startDate
const updateBookingStatus = async (req, res) => {
  try {
    // Get current date at midnight
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Find bookings that should be marked as inProgress
    // Criteria: status is 'confirmed' AND startDate is today
    const bookingsToUpdate = await Booking.find({
      status: 'confirmed',
      startDate: {
        $gte: currentDate, 
        $lt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) // less than tomorrow
      }
    });
    
    console.log(`🔍 Found ${bookingsToUpdate.length} bookings to update to inProgress`);
    
    if (bookingsToUpdate.length === 0) {
      return res.status(200).json({ 
        message: 'No bookings to update',
        updatedCount: 0
      });
    }
    
    // Update all matching bookings
    const updatePromises = bookingsToUpdate.map(booking => {
      console.log(`✅ Updating booking ${booking._id} to inProgress`);
      booking.status = 'inProgress';
      return booking.save();
    });
    
    await Promise.all(updatePromises);
    
    return res.status(200).json({
      message: 'Bookings updated to inProgress successfully',
      updatedCount: bookingsToUpdate.length,
      bookings: bookingsToUpdate
    });
    
  } catch (error) {
    console.error("❌ Update Booking Status Error:", error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Scheduled function to be called by a cron job (no HTTP response)
const scheduledStatusUpdate = async () => {
  try {
    // Get current date at midnight
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Find bookings that should be marked as inProgress
    const bookingsToUpdate = await Booking.find({
      status: 'confirmed',
      startDate: {
        $gte: currentDate, 
        $lt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    console.log(`🔍 Scheduled task: Found ${bookingsToUpdate.length} bookings to update to inProgress`);
    
    if (bookingsToUpdate.length === 0) {
      console.log('No bookings to update to inProgress');
      return { updatedCount: 0 };
    }
    
    // Update all matching bookings
    const updatePromises = bookingsToUpdate.map(booking => {
      console.log(`✅ Updating booking ${booking._id} to inProgress`);
      booking.status = 'inProgress';
      return booking.save();
    });
    
    const updatedBookings = await Promise.all(updatePromises);
    console.log(`✅ Updated ${updatedBookings.length} bookings to inProgress`);
    
    return { 
      updatedCount: updatedBookings.length,
      bookings: updatedBookings
    };
  } catch (error) {
    console.error("❌ Scheduled Update Booking Status Error:", error);
    throw error;
  }
};

const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log("🔹 Received Booking Request:", req.body);
    
    // Extract data from request body using the frontend parameter names
    const { user, car, startDate, endDate, pickupLocation, dropoffLocation, totalPrice } = req.body;

    // Validate required fields
    if (!user || !car || !startDate || !endDate || !pickupLocation || !dropoffLocation) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find car and validate existence
    const carDocument = await Car.findById(car).session(session);
    if (!carDocument) {
      console.error("❌ Car not found:", car);
      return res.status(404).json({ message: 'Car not found' });
    }
    
    // Check if car is available
    if (!carDocument.available) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ Car not available:", car);
      return res.status(400).json({ message: 'Car is not available for booking' });
    }

    console.log("✅ Car Found:", carDocument);

    // Create booking with frontend-provided data
    const booking = new Booking({
      user,
      car,
      startDate,
      endDate,
      pickupLocation,
      dropoffLocation,
      totalPrice,
      status: 'pending'
    });

    await booking.save({ session });
    console.log("✅ Booking Created:", booking);

    await session.commitTransaction();
    session.endSession();

    console.log("🚀 Booking Successfully Saved & Committed");
    return res.status(201).json({ message: 'Booking created', booking });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Booking Error:", error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const processPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { bookingId } = req.params;
    const { user } = req.body;  // Updated from userId to user to match frontend

    // Find the booking
    const booking = await Booking.findById(bookingId).populate('car').session(session);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Find the user's wallet
    const userWallet = await Wallet.findOne({ userId: user }).session(session);  // Updated to use user
    if (!userWallet || userWallet.balance < booking.totalPrice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Find admin account
    const admin = await User.findOne({ role: 'admin' }).session(session);
    if (!admin) return res.status(500).json({ message: 'Admin account not found' });

    let adminWallet = await Wallet.findOne({ userId: admin._id }).session(session);
    if (!adminWallet) {
      adminWallet = new Wallet({ userId: admin._id, balance: 0, transactions: [] });
      await adminWallet.save({ session });
    }

    // Deduct from user wallet
    userWallet.balance -= booking.totalPrice;
    userWallet.transactions.push({
      type: 'debit',
      amount: booking.totalPrice,
      description: `Payment for booking (ID: ${booking._id})`,
      date: new Date()
    });

    // Credit to admin wallet
    adminWallet.balance += booking.totalPrice;
    adminWallet.transactions.push({
      type: 'credit',
      amount: booking.totalPrice,
      description: `Received payment for booking (ID: ${booking._id})`,
      date: new Date()
    });

    await userWallet.save({ session });
    await adminWallet.save({ session });

    // Create transaction record
    const transaction = new Transaction({
      userId: user,  // Updated from userId to user
      walletId: userWallet._id,
      amount: booking.totalPrice,
      transactionType: 'debit',
      status: 'completed',
      description: `Payment for booking (ID: ${booking._id})`,
      date: new Date()
    });

    await transaction.save({ session });

    // Update car availability status
    const car = await Car.findById(booking.car).session(session);
    if (car) {
      car.available = false;
      await car.save({ session });
      console.log("✅ Car availability updated to false:", car._id);
    }

    // Update booking status
    booking.status = 'confirmed';
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ 
      message: 'Payment successful', 
      booking, 
      balance: userWallet.balance 
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Payment Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Using populate with specific field selection for better performance
    const bookings = await Booking.find({ user: userId })
      .populate({
        path: 'car',
        select: 'make model year type transmission pricePerDay images features location'
      })
      .sort({ createdAt: -1 });
    
    // Format the response data for the frontend
    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      startDate: booking.startDate,
      endDate: booking.endDate,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
      totalPrice: booking.totalPrice,
      status: booking.status,
      createdAt: booking.createdAt,
      car: booking.car ? {
        _id: booking.car._id,
        model: `${booking.car.make} ${booking.car.model} (${booking.car.year})`,
        make: booking.car.make,
        year: booking.car.year,
        type: booking.car.type,
        transmission: booking.car.transmission,
        pricePerDay: booking.car.pricePerDay,
        mainImage: booking.car.images && booking.car.images.length > 0 ? booking.car.images[0] : null,
        images: booking.car.images || [],
        features: booking.car.features || [],
        location: booking.car.location
      } : null
    }));
    
    res.status(200).json(formattedBookings);
  } catch (error) {
    console.error("❌ Get Bookings Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// New function to handle booking completion (when rental period is over)
const completeBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { bookingId } = req.params;
    
    // Find the booking
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Updated to allow completion from either confirmed or inProgress status
    if (booking.status !== 'confirmed' && booking.status !== 'inProgress') {
      return res.status(400).json({ message: 'Only confirmed or in-progress bookings can be completed' });
    }
    
    // Update car availability back to true
    const car = await Car.findById(booking.car).session(session);
    if (car) {
      car.available = true;
      await car.save({ session });
      console.log("✅ Car availability updated to true:", car._id);
    }
    
    // Update booking status
    booking.status = 'completed';
    await booking.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ 
      message: 'Booking completed successfully', 
      booking
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Complete Booking Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { bookingId } = req.params;
    
    // Find and validate booking
    const booking = await Booking.findById(bookingId)
      .populate('car')
      .session(session);
      
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Updated to not allow cancellation of inProgress bookings
    if (booking.status !== 'confirmed') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Only confirmed bookings can be cancelled' });
    }

    // Find admin wallet
    const admin = await User.findOne({ role: 'admin' }).session(session);
    const adminWallet = await Wallet.findOne({ userId: admin._id }).session(session);
    
    if (!adminWallet || adminWallet.balance < booking.totalPrice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Unable to process refund' });
    }

    // Find user wallet
    const userWallet = await Wallet.findOne({ userId: booking.user }).session(session);
    if (!userWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User wallet not found' });
    }

    // Process refund
    adminWallet.balance -= booking.totalPrice;
    adminWallet.transactions.push({
      type: 'debit',
      amount: booking.totalPrice,
      description: `Refund for cancelled booking (ID: ${booking._id})`,
      date: new Date()
    });

    userWallet.balance += booking.totalPrice;
    userWallet.transactions.push({
      type: 'credit',
      amount: booking.totalPrice,
      description: `Refund received for cancelled booking (ID: ${booking._id})`,
      date: new Date()
    });

    // Create refund transaction record
    const transaction = new Transaction({
      userId: booking.user,
      walletId: userWallet._id,
      amount: booking.totalPrice,
      transactionType: 'credit',
      status: 'completed',
      description: `Refund for cancelled booking (ID: ${booking._id})`,
      date: new Date()
    });

    // Update car availability
    const car = await Car.findById(booking.car).session(session);
    if (car) {
      car.available = true;
      await car.save({ session });
    }

    // Update booking status
    booking.status = 'cancelled';

    // Save all changes
    await adminWallet.save({ session });
    await userWallet.save({ session });
    await transaction.save({ session });
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'Booking cancelled and refund processed successfully',
      booking,
      refundAmount: booking.totalPrice,
      newBalance: userWallet.balance
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Cancel Booking Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('car')
      .populate('user', 'firstName lastName email phoneNumber drivingLicense')
      .sort({ createdAt: -1 });
    
    res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ Get All Bookings Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { 
  createBooking, 
  processPayment, 
  getBookings,
  completeBooking,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
  scheduledStatusUpdate
};