const cron = require('node-cron');
const Viewing = require('../models/Viewing');

// Run every 10 minutes to check upcoming viewings in next 2 hours
const initReminderScheduler = () => {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const dueViewings = await Viewing.find({
        status: 'Scheduled',
        reminderSent: false,
        scheduledDate: { $gte: now, $lte: twoHoursAhead }
      }).populate('lead property');

      for (const viewing of dueViewings) {
        console.log(`[Auto-Reminder] Simulating SMS/Email sent to ${viewing.lead?.name || 'Lead'} for viewing at ${viewing.property?.title || 'Property'}`);
        viewing.reminderSent = true;
        await viewing.save();
      }
    } catch (err) {
      console.error('Error running reminder scheduler:', err.message);
    }
  });
};

module.exports = initReminderScheduler;
