const express = require('express');
const { createBooking, processPayment, getBookings,completeBooking,cancelBooking,getAllBookings} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');  // Ensure correct path

const router = express.Router();

router.post('/', protect, authorize('user'), createBooking);  // POST /api/bookings
router.post('/:bookingId/payment', protect, authorize('user'), processPayment);
router.get('/:userId', protect, getBookings);
router.patch('/:bookingId/complete', protect, completeBooking);
router.post('/:bookingId/cancel',cancelBooking);
router.get('/admin/all', protect, authorize('admin'), getAllBookings);


module.exports = router;