const mongoose = require('mongoose');

const ViewingSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    durationMinutes: {
      type: Number,
      default: 45
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled', 'No-Show'],
      default: 'Scheduled'
    },
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comments: { type: String, default: '' },
      interestedInOffer: { type: Boolean, default: false }
    },
    reminderSent: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Viewing', ViewingSchema);
