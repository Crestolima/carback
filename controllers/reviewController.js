const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Car = require('../models/Car');

const createReview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id; // Assuming you have user info in req.user

    // Validate booking exists and belongs to user
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify booking belongs to the user
    if (booking.user.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Unauthorized to review this booking' });
    }

    if (booking.status !== 'completed') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Can only review completed bookings' });
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ booking: bookingId }).session(session);
    if (existingReview) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Review already exists for this booking' });
    }

    // Create the review
    const review = new Review({
      booking: bookingId,
      user: userId,
      car: booking.car,
      rating,
      comment
    });

    await review.save({ session });

    // Update car's average rating
    const allCarReviews = await Review.find({ car: booking.car }).session(session);
    const avgRating = allCarReviews.reduce((acc, rev) => acc + rev.rating, 0) / allCarReviews.length;
    
    await Car.findByIdAndUpdate(booking.car, { 
      averageRating: avgRating,
      totalReviews: allCarReviews.length 
    }, { session });

    await session.commitTransaction();
    session.endSession();

    // Populate user and car details for the response
    const populatedReview = await Review.findById(review._id)
      .populate('user', 'firstName lastName')
      .populate('car', 'make model year');

    res.status(201).json({
      message: 'Review submitted successfully',
      review: populatedReview
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Create Review Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getCarReviews = async (req, res) => {
  try {
    const { carId } = req.params;
    
    const reviews = await Review.find({ car: carId })
      .populate('user', 'firstName lastName')
      .populate('booking', 'startDate endDate')
      .sort({ createdAt: -1 });

    const car = await Car.findById(carId);

    res.status(200).json({
      reviews,
      averageRating: car.averageRating || 0,
      totalReviews: car.totalReviews || 0
    });

  } catch (error) {
    console.error("❌ Get Car Reviews Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getOverallRatings = async (req, res) => {
  try {
    // Get overall platform statistics
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          fiveStarCount: { 
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] }
          },
          fourStarCount: { 
            $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] }
          },
          threeStarCount: { 
            $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] }
          },
          twoStarCount: { 
            $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] }
          },
          oneStarCount: { 
            $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          averageRating: { $round: ["$averageRating", 1] }, // Round to 1 decimal place
          totalReviews: 1,
          distribution: {
            "5": "$fiveStarCount",
            "4": "$fourStarCount",
            "3": "$threeStarCount",
            "2": "$twoStarCount",
            "1": "$oneStarCount"
          }
        }
      }
    ]);

    // Get top rated cars
    const topRatedCars = await Car.find({ totalReviews: { $gt: 0 } })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .select('_id make model year averageRating totalReviews');

    // Get most reviewed cars
    const mostReviewedCars = await Car.find({ totalReviews: { $gt: 0 } })
      .sort({ totalReviews: -1, averageRating: -1 })
      .limit(5)
      .select('_id make model year averageRating totalReviews');

    // Get recent reviews
    const recentReviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'firstName lastName')
      .populate('car', 'make model year')
      .select('rating comment createdAt');

    res.status(200).json({
      overall: stats.length > 0 ? stats[0] : { 
        averageRating: 0, 
        totalReviews: 0,
        distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
      },
      topRatedCars,
      mostReviewedCars,
      recentReviews
    });
  } catch (error) {
    console.error("❌ Get Overall Ratings Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




module.exports = {
  createReview,
  getCarReviews,
  getOverallRatings
};
