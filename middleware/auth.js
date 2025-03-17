const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log("Received Token:", token); // Debugging line

      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("Decoded Token:", decoded); // Debugging line

      req.user = await User.findById(decoded.id).select('-password');
      console.log("Authenticated User:", req.user); // Debugging line

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log("No Authorization Header Found");
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// New middleware for role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

module.exports = { protect, authorize };
