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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
