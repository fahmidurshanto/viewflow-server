const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 1. Check HttpOnly Cookie first (Most secure)
  if (req.cookies && req.cookies.viewflow_token) {
    token = req.cookies.viewflow_token;
  }
  // 2. Fallback to Authorization Bearer header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'viewflow_jwt_secret_key');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token verification failed: ' + err.message });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.viewflow_token) {
    token = req.cookies.viewflow_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'viewflow_jwt_secret_key');
      const user = await User.findById(decoded.id).select('-password');
      if (user) req.user = user;
    } catch (e) {
      // Ignore invalid token on optional routes
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
