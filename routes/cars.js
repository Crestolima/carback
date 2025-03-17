const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary'); // Updated to use Cloudinary config
const {
  getCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  searchCars
} = require('../controllers/carController');

router.route('/')
  .get(getCars) // Public route: Anyone can view cars
  .post(
    protect, 
    authorize('admin'), 
    upload.array('images', 5), // Using Cloudinary upload middleware
    createCar
  ); // Only admins can add cars

router.route('/:id')
  .get(getCarById) // Public route: Anyone can view a specific car
  .put(
    protect, 
    authorize('admin'), 
    upload.array('images', 5), // Using Cloudinary upload middleware
    updateCar
  ) // Only admins can update
  .delete(protect, authorize('admin'), deleteCar); // Only admins can delete

  router.get('/search', searchCars); // Public route: Anyone can search cars

module.exports = router;