// viewflow-server/middleware/planAccess.js
const { getPlanLimits } = require('../config/plans');
const Property = require('../models/Property');
const User = require('../models/User');

/**
 * Check if the user is in an active subscription or unexpired trial
 */
const isSubscriptionOrTrialActive = (user) => {
  if (user.subscriptionStatus === 'active') return true;
  if (user.subscriptionStatus === 'trial') {
    if (!user.trialEndsAt) return true;
    return new Date(user.trialEndsAt) > new Date();
  }
  return false;
};

/**
 * Middleware to check property count limit before creation
 */
const checkPropertyLimit = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if trial has expired
    if (user.subscriptionStatus === 'trial' && user.trialEndsAt && new Date(user.trialEndsAt) <= new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Your 30-day free trial has expired. Please select a plan to continue adding properties.',
        code: 'TRIAL_EXPIRED',
        requiresPlanSelection: true
      });
    }

    const userPlan = user.subscriptionPlan || 'Starter';
    const limits = getPlanLimits(userPlan);

    if (limits.maxProperties !== Infinity) {
      const propertyCount = await Property.countDocuments({ user: req.user._id });
      if (propertyCount >= limits.maxProperties) {
        return res.status(403).json({
          success: false,
          error: `You have reached the maximum limit of ${limits.maxProperties} properties for the ${userPlan} plan. Please upgrade to Growth for unlimited listings.`,
          code: 'PLAN_LIMIT_REACHED',
          requiredPlan: 'Growth',
          currentCount: propertyCount,
          maxLimit: limits.maxProperties
        });
      }
    }
    next();
  } catch (error) {
    console.error('Error checking property limits:', error);
    res.status(500).json({ success: false, error: 'Failed to verify subscription limits.' });
  }
};

/**
 * Middleware to gate specific feature flags
 */
const requireFeature = (featureName, requiredPlan = 'Growth') => {
  return (req, res, next) => {
    const userPlan = req.user.subscriptionPlan || 'Starter';
    const limits = getPlanLimits(userPlan);

    if (!limits[featureName]) {
      return res.status(403).json({
        success: false,
        error: `The ${featureName} feature requires a ${requiredPlan} plan or higher.`,
        code: 'FEATURE_GATED',
        feature: featureName,
        requiredPlan
      });
    }
    next();
  };
};

module.exports = {
  checkPropertyLimit,
  requireFeature
};
