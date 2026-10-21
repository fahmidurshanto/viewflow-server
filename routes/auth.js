const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'viewflow_jwt_secret_key', {
    expiresIn: '30d'
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  // HttpOnly Cookie Options
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  };

  res
    .status(statusCode)
    .cookie('viewflow_token', token, cookieOptions)
    .json({
      success: true,
      token, // Also provided for backwards compatibility if needed
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        agencyName: user.agencyName,
        phone: user.phone,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan || 'Growth',
        subscriptionBillingCycle: user.subscriptionBillingCycle || 'monthly',
        subscriptionStatus: user.subscriptionStatus || 'trial',
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt
      }
    });
};

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, agencyName, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please sign in.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      agencyName: agencyName || 'Independent Real Estate Agency',
      phone: phone || ''
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Password incorrect.' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT (/api/auth/logout)
router.post('/logout', (req, res) => {
  res.cookie('viewflow_token', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET CURRENT USER (/api/auth/me)
router.get('/me', protect, async (req, res) => {
  res.json({
    user: req.user
  });
});

// UPDATE SUBSCRIPTION PLAN (/api/auth/subscription)
router.put('/subscription', protect, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    const validPlans = ['Starter', 'Growth', 'Enterprise'];
    const validCycles = ['monthly', 'yearly'];

    if (plan && !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }
    if (billingCycle && !validCycles.includes(billingCycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (plan) user.subscriptionPlan = plan;
    if (billingCycle) user.subscriptionBillingCycle = billingCycle;
    user.subscriptionStatus = 'active';

    await user.save();

    res.json({
      success: true,
      message: `Subscription successfully updated to ${user.subscriptionPlan} (${user.subscriptionBillingCycle})!`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        agencyName: user.agencyName,
        phone: user.phone,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionBillingCycle: user.subscriptionBillingCycle,
        subscriptionStatus: user.subscriptionStatus,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
