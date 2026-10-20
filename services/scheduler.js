const cron = require('node-cron');
const Viewing = require('../models/Viewing');
const Settings = require('../models/Settings');
const { sendEmail, sendWhatsApp } = require('./notificationService');

/**
 * Automated Cron Job:
 * Runs every 5 minutes.
 * Checks for upcoming viewings in the next reminder window (e.g. 2 hours)
 * and dispatches free Email & WhatsApp notifications.
 */
const initReminderScheduler = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const dueViewings = await Viewing.find({
        status: 'Scheduled',
        reminderSent: false,
        scheduledDate: { $gte: now, $lte: twoHoursAhead }
      }).populate('lead property user');

      for (const viewing of dueViewings) {
        if (!viewing.lead) continue;

        // Fetch preferences for the viewing's owner
        const userQuery = viewing.user ? { user: viewing.user._id || viewing.user } : {};
        const settings = await Settings.findOne(userQuery);

        const emailEnabled = settings?.enableEmailReminder !== false;
        const whatsAppEnabled = settings?.enableWhatsAppReminder !== false;

        const propertyTitle = viewing.property?.title || 'Property Viewing';
        const formattedTime = new Date(viewing.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // 1. Send WhatsApp reminder
        if (whatsAppEnabled && viewing.lead.phone) {
          await sendWhatsApp({
            to: viewing.lead.phone,
            message: `Hi ${viewing.lead.name}! Friendly reminder: your property viewing for "${propertyTitle}" is today at ${formattedTime}. See you there! - ${settings?.agencyName || 'ViewFlow'}`,
            settings
          });
        }

        // 2. Send Free Gmail Email reminder
        if (emailEnabled && viewing.lead.email) {
          await sendEmail({
            to: viewing.lead.email,
            subject: `Reminder: Property Viewing at ${formattedTime} today - ${propertyTitle}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #2563eb; margin-top: 0;">Upcoming Property Viewing Reminder</h2>
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                  Dear ${viewing.lead.name}, this is a friendly reminder that your private viewing appointment is scheduled in approximately 2 hours.
                </p>
                <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #2563eb;">
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Property:</strong> ${propertyTitle}</p>
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Time:</strong> ${formattedTime} (${viewing.durationMinutes || 45} mins)</p>
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Location:</strong> ${viewing.property?.address?.street || ''}, ${viewing.property?.address?.city || ''}</p>
                </div>
                <p style="color: #64748b; font-size: 13px;">
                  If you need to reschedule or have any questions, please contact our agent directly.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px; white-space: pre-line; margin-bottom: 0;">
                  ${settings?.emailSignature || `Best regards,\n${settings?.agencyName || 'ViewFlow Premier Real Estate'}`}
                </p>
              </div>
            `,
            settings
          });
        }

        viewing.reminderSent = true;
        await viewing.save();
        console.log(`[Free Reminder Processed] ${viewing.lead.name} for ${propertyTitle}`);
      }
    } catch (err) {
      console.error('Error running scheduler:', err.message);
    }
  });
};

module.exports = initReminderScheduler;
