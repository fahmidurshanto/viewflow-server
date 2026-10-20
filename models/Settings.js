const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    agencyName: {
      type: String,
      default: 'ViewFlow Premier Real Estate'
    },
    agentEmail: {
      type: String,
      default: 'admin@viewflow.demo'
    },
    agentPhone: {
      type: String,
      default: '+15550192834'
    },
    emailSignature: {
      type: String,
      default: 'Best regards,\nYour ViewFlow Property Concierge Team'
    },
    // Notification toggles
    enableEmailConfirmation: {
      type: Boolean,
      default: true
    },
    enableEmailReminder: {
      type: Boolean,
      default: true
    },
    enableWhatsAppReminder: {
      type: Boolean,
      default: true
    },
    reminderHoursBefore: {
      type: Number,
      default: 2
    },
    autoPromoteLeadOnBooking: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', SettingsSchema);
