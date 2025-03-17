const express = require('express');
const router = express.Router();
const { createPayment } = require('../controllers/paymentController'); // Correct import from paymentController
const { protect } = require('../middleware/auth'); // If you want to protect this route

// Route to create a payment (protected)
router.post('/create', protect, createPayment); // Only authorized users can name payments

module.exports = router;
