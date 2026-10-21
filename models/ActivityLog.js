const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead'
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property'
    },
    viewing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Viewing'
    },
    type: {
      type: String,
      enum: ['Call', 'Email', 'Viewing Note', 'Stage Changed', 'General', 'Viewing Booked', 'Viewing Completed', 'Reminder Sent'],
      default: 'General'
    },
    title: { type: String },
    note: { type: String, required: true },
    author: { type: String, default: 'Agent' },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
