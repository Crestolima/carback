const Car = require('../models/Car');
const fs = require('fs').promises;
const path = require('path');
const { cloudinary } = require('../config/cloudinary');

const createCar = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      const error = new Error('No images provided');
      error.statusCode = 400;
      throw error;
    }

    // Get Cloudinary URLs from uploaded files
    const imageUrls = req.files.map(file => file.path);

    let carData = {
      make: req.body.make,
      model: req.body.model,
      year: parseInt(req.body.year),
      type: req.body.type,
      transmission: req.body.transmission,
      pricePerDay: parseFloat(req.body.pricePerDay),
      available: req.body.available === 'true',
      images: imageUrls,
      features: [],
      location: {
        city: '',
        address: '',
        coordinates: {
          latitude: 0,
          longitude: 0
        }
      }
    };

    // Parse features
    if (req.body.features) {
      try {
        carData.features = JSON.parse(req.body.features);
      } catch (e) {
        const error = new Error('Invalid features data');
        error.statusCode = 400;
        throw error;
      }
    }

    // Parse location
    if (req.body.location) {
      try {
        carData.location = JSON.parse(req.body.location);
      } catch (e) {
        const error = new Error('Invalid location data');
        error.statusCode = 400;
        throw error;
      }
    }

    const car = await Car.create(carData);
    res.status(201).json(car);
  } catch (error) {
    // Delete uploaded images from Cloudinary if there's an error
    if (req.files) {
      for (const file of req.files) {
        const publicId = file.filename; // Cloudinary public ID
        await cloudinary.uploader.destroy(publicId).catch(err => 
          console.error('Error deleting image from Cloudinary:', err)
        );
      }
    }
    next(error);
  }
};

const updateCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      const error = new Error('Car not found');
      error.statusCode = 404;
      throw error;
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      for (const imageUrl of car.images) {
        const publicId = imageUrl.split('/').pop().split('.')[0]; // Extract public ID from URL
        await cloudinary.uploader.destroy(publicId).catch(err => 
          console.error('Error deleting old image from Cloudinary:', err)
        );
      }

      // Add new image URLs
      req.body.images = req.files.map(file => file.path);
    }

    // Parse JSON fields
    if (req.body.features) {
      try {
        req.body.features = JSON.parse(req.body.features);
      } catch (e) {
        const error = new Error('Invalid features data');
        error.statusCode = 400;
        throw error;
      }
    }

    if (req.body.location) {
      try {
        req.body.location = JSON.parse(req.body.location);
      } catch (e) {
        const error = new Error('Invalid location data');
        error.statusCode = 400;
        throw error;
      }
    }

    Object.assign(car, req.body);
    const updatedCar = await car.save();
    res.json(updatedCar);
  } catch (error) {
    // Delete new uploaded images from Cloudinary if there's an error
    if (req.files) {
      for (const file of req.files) {
        const publicId = file.filename;
        await cloudinary.uploader.destroy(publicId).catch(err => 
          console.error('Error deleting image from Cloudinary:', err)
        );
      }
    }
    next(error);
  }
};

const deleteCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      const error = new Error('Car not found');
      error.statusCode = 404;
      throw error;
    }

    // Delete associated images from Cloudinary
    for (const imageUrl of car.images) {
      const publicId = imageUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId).catch(err => 
        console.error('Error deleting image from Cloudinary:', err)
      );
    }

    await car.remove();
    res.json({ message: 'Car removed' });
  } catch (error) {
    next(error);
  }
};

const getCars = async (req, res, next) => {
  try {
    const cars = await Car.find({});
    res.json(cars);
  } catch (error) {
    next(error);
  }
};

const getCarById = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      const error = new Error('Car not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(car);
  } catch (error) {
    if (error.name === 'CastError') {
      error.statusCode = 404;
      error.message = 'Car not found - Invalid ID';
    }
    next(error);
  }
};

const searchCars = async (req, res, next) => {
  try {
    const {
      make,
      model,
      year,
      type,
      transmission,
      minPrice,
      maxPrice,
      available,
      city,
      features
    } = req.query;

    // Build query object
    const query = {};

    // Add filters to query
    if (make) query.make = { $regex: make, $options: 'i' }; // Case-insensitive search
    if (model) query.model = { $regex: model, $options: 'i' };
    if (year) query.year = year;
    if (type) query.type = { $regex: type, $options: 'i' };
    if (transmission) query.transmission = { $regex: transmission, $options: 'i' };
    
    // Price range
    if (minPrice || maxPrice) {
      query.pricePerDay = {};
      if (minPrice) query.pricePerDay.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerDay.$lte = parseFloat(maxPrice);
    }
    
    // Availability
    if (available !== undefined) {
      query.available = available === 'true';
    }
    
    // Location search
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }
    
    // Features search (if features is comma-separated string of features)
    if (features) {
      const featureArray = features.split(',').map(feature => feature.trim());
      query.features = { $all: featureArray }; // All specified features must be present
    }

    const cars = await Car.find(query);
    
    res.json({
      count: cars.length,
      cars
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  searchCars
};