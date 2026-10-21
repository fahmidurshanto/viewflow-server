const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    agencyName: {
      type: String,
      default: 'ViewFlow Premier Estates'
    },
    phone: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['agent', 'agency_admin'],
      default: 'agent'
    },
    avatar: {
      type: String,
      default: ''
    },
    // Subscription & Billing details
    subscriptionPlan: {
      type: String,
      enum: ['Starter', 'Growth', 'Enterprise'],
      default: 'Growth'
    },
    subscriptionBillingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'trial', 'expired', 'past_due'],
      default: 'trial'
    },
    trialStartedAt: {
      type: Date,
      default: Date.now
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 1 Month (30 Days) free trial
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
