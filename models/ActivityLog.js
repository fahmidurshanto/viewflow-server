const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    type: {
      type: String,
      enum: ['Call', 'Email', 'Viewing Note', 'Stage Changed', 'General'],
      default: 'General'
    },
    note: { type: String, required: true },
    author: { type: String, default: 'Agent' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
