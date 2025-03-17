
const mongoose = require('mongoose'); // Import mongoose

const reviewSchema = new mongoose.Schema({
  booking: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true,
    unique: true // One review per booking
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  car: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Car', 
    required: true 
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String, 
    required: true,
    minlength: 10,
    maxlength: 500
  }
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review; // Export the model


