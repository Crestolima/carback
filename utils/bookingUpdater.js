const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Car = require('../models/Car');

/**
 * Updates expired bookings to 'completed' status and marks cars as available
 * Should be run periodically (e.g., daily via a cron job)
 */
const updateExpiredBookings = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("🔄 Starting expired bookings check...");

    // Find all confirmed bookings that have ended
    const expiredBookings = await Booking.find({
      status: 'confirmed',
      endDate: { $lt: new Date() }
    }).session(session);

    console.log(`📊 Found ${expiredBookings.length} expired bookings`);

    // Process each expired booking
    for (const booking of expiredBookings) {
      // Update booking status
      booking.status = 'completed';
      await booking.save({ session });

      // Update car availability
      const car = await Car.findById(booking.car).session(session);
      if (car) {
        car.available = true;
        await car.save({ session });
        console.log(`✅ Updated car ${car._id} availability to true`);
      }

      console.log(`✅ Completed booking ${booking._id}`);
    }

    await session.commitTransaction();
    console.log("🎉 Successfully updated all expired bookings");

    return {
      success: true,
      processed: expiredBookings.length,
      message: `Successfully processed ${expiredBookings.length} expired bookings`
    };

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error updating expired bookings:", error);
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to process expired bookings'
    };

  } finally {
    session.endSession();
  }
};

// Export the function
module.exports = { updateExpiredBookings };