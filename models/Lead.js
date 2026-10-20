const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    stage: {
      type: String,
      enum: ['Enquiry', 'Contacted', 'Viewing', 'Offer', 'Closed'],
      default: 'Enquiry'
    },
    budget: { type: Number, default: 0 },
    preferredLocation: { type: String, default: '' },
    interestedProperty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null
    },
    notes: { type: String, default: '' },
    source: {
      type: String,
      enum: ['Website', 'Portal', 'Referral', 'Walk-in', 'Direct Call'],
      default: 'Website'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', LeadSchema);
