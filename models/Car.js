const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  type: { type: String, required: true },
  transmission: { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  available: { type: Boolean, default: true },
  images: [String],
  features: [String],
  location: {
    city: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }
});

module.exports = mongoose.model('Car', carSchema);
