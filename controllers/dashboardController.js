// controllers/dashboardController.js
const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

// Helper function to get date range for last 6 months
const getLastSixMonthsRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 5); // Get 6 months including current
  startDate.setDate(1); // Start from first day of month
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate };
};

const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = getLastSixMonthsRange();

    // Execute all queries in parallel for better performance
    const [
      userCount,
      carsData,
      bookingsData,
      revenueData,
      monthlyStats
    ] = await Promise.all([
      // Get total users count
      User.countDocuments({ role: 'user' }),

      // Get cars with availability status
      Car.find().select('available pricePerDay'),

      // Get all bookings with essential fields
      Booking.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).select('totalPrice status createdAt'),

      // Get total revenue from completed bookings
      Booking.aggregate([
        {
          $match: {
            status: 'confirmed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPrice' }
          }
        }
      ]),

      // Get monthly bookings and revenue
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            bookings: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'confirmed'] }, '$totalPrice', 0]
              }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ])
    ]);

    // Process monthly stats into a format suitable for charts
    const monthlyChartData = monthlyStats.map(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1);
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        bookings: stat.bookings,
        earnings: stat.revenue
      };
    });

    // Calculate growth percentages
    const calculateGrowth = (data, key) => {
      if (data.length < 2) return 0;
      const current = data[data.length - 1][key];
      const previous = data[data.length - 2][key];
      return previous ? ((current - previous) / previous) * 100 : 0;
    };

    const bookingsGrowth = calculateGrowth(monthlyChartData, 'bookings');
    const revenueGrowth = calculateGrowth(monthlyChartData, 'earnings');

    // Prepare dashboard response
    const dashboardData = {
      stats: {
        users: {
          total: userCount,
          change: 0 // You might want to calculate this based on historical data
        },
        cars: {
          total: carsData.length,
          available: carsData.filter(car => car.available).length,
          change: 0
        },
        earnings: {
          total: revenueData[0]?.totalRevenue || 0,
          change: revenueGrowth
        },
        bookings: {
          total: bookingsData.length,
          change: bookingsGrowth
        }
      },
      charts: {
        bookings: monthlyChartData.map(({ month, bookings }) => ({
          month,
          bookings
        })),
        earnings: monthlyChartData.map(({ month, earnings }) => ({
          month,
          earnings
        }))
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard Data Error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
};

module.exports = {
  getDashboardStats
};