
const express = require('express');

const router = express.Router();
const { createReview, getCarReviews,getOverallRatings } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

router.post('/booking/:bookingId', protect,authorize('user'), createReview);
router.get('/car/:carId',authorize('user'), getCarReviews);
router.get('/stats',protect,authorize('admin') ,getOverallRatings);

module.exports = router;