const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/config');

const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, drivingLicense } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      drivingLicense
    });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};


// Fetch all users except admins
const getUsers = async (req, res) => {
  try {
    // Fetch all users except for those with the role 'admin'
    const users = await User.find({ role: { $ne: 'admin' } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
};

const getUserCount = async (req, res) => {
  try {
    const { role } = req.query;
    const count = await User.countDocuments(role ? { role } : {});
    res.json(count);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user count' });
  }
};

// Search users with various filters
const searchUsers = async (req, res) => {
  try {
    const { query, role, sort, limit = 10, page = 1 } = req.query;
    
    // Build the search criteria
    const searchCriteria = {};
    
    // Add role filter if specified (but don't include admins unless explicitly requested)
    if (role) {
      searchCriteria.role = role;
    } else {
      // By default, exclude admin users
      searchCriteria.role = { $ne: 'admin' };
    }
    
    // Add search query if provided
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      searchCriteria.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Determine sort order
    let sortOptions = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions[field] = order === 'desc' ? -1 : 1;
    } else {
      // Default sort by creation date, newest first
      sortOptions = { createdAt: -1 };
    }
    
    // Execute the query with pagination
    const users = await User.find(searchCriteria)
      .select('-password')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get total count for pagination
    const total = await User.countDocuments(searchCriteria);
    
    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching users', error: error.message });
  }
};

// Admin create user (can create both regular users and admins)
const createUser = async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create new users' });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phoneNumber, 
      drivingLicense, 
      role 
    } = req.body;
    
    // Validate role
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    
    // Check if email already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Create the new user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      drivingLicense,
      role: role || 'user' // Default to 'user' if not specified
    });
    
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      drivingLicense: user.drivingLicense,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Make sure the user being deleted exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Admin users can delete any user, regular users can only delete themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'You can only delete your own account' });
    }
    
    // Don't allow deletion of the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }
    
    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber, drivingLicense, role } = req.body;
    
    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check permissions: admin can update any user, regular users can only update themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'You can only update your own account' });
    }
    
    // Only admin can change roles
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change user roles' });
    }
    
    // Don't allow changing the role of the last admin
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot downgrade the last admin user' });
      }
    }
    
    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Update the user
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.drivingLicense = drivingLicense || user.drivingLicense;
    if (role && ['user', 'admin'].includes(role)) {
      user.role = role;
    }
    
    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      drivingLicense: updatedUser.drivingLicense,
      role: updatedUser.role,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user' });
  }
};


module.exports = {   registerUser, 
  loginUser, 
  getUsers, 
  getUserCount, 
  searchUsers, 
  createUser, 
  deleteUser, 
  updateUser,
  getUserById };