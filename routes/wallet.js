// walletRoutes.js
const express = require('express');
const router = express.Router();
const { addFunds, namePayment, getWallet } = require('../controllers/walletController');

// Add the new GET route
router.get('/:userId', getWallet);
router.post('/add-funds', addFunds);
router.post('/pay', namePayment);

module.exports = router;