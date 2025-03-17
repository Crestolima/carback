const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUsers, 
  getUserCount, 
  searchUsers, 
  createUser, 
  deleteUser, 
  updateUser,
  getUserById
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes - require authentication
router.get('/users', protect, getUsers);
router.get('/users/count', protect, getUserCount);
router.get('/users/search', protect, searchUsers);
router.get('/users/:id', protect, getUserById);

// Admin routes - require admin role
router.post('/users', protect, authorize('admin'), createUser);
router.put('/users/:id', protect, updateUser); // Note: Regular users can update themselves
router.delete('/users/:id', protect, deleteUser); // Note: Regular users can delete themselves

module.exports = router;