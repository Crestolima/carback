const validateBooking = (req, res, next) => {
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Please provide start and end dates' });
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }
  next();
};

const validateReview = (req, res, next) => {
  const { rating, comment } = req.body;
  if (!rating || !comment) {
    return res.status(400).json({ message: 'Please provide rating and comment' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }
  next();
};

module.exports = { validateBooking, validateReview };
