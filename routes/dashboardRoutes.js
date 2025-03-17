// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth'); 

// Protected admin route to get dashboard stats
router.get('/stats', protect, authorize('admin'), getDashboardStats);

module.exports = router;