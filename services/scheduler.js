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
        const formattedDate = new Date(viewing.scheduledDate).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const formattedTime = new Date(viewing.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const durationStr = `${viewing.durationMinutes || 45} mins`;
        const locationStr = viewing.property?.address
          ? `${viewing.property.address.street || ''}${viewing.property.address.city ? ', ' + viewing.property.address.city : ''}`.trim() || 'Property Location'
          : 'Property Location';

        const templateVars = {
          clientName: viewing.lead.name || 'Valued Client',
          propertyTitle,
          viewingDate: formattedDate,
          viewingTime: formattedTime,
          duration: durationStr,
          location: locationStr,
          agencyName: settings?.agencyName || 'ViewFlow Premier Real Estate',
          agentEmail: settings?.agentEmail || '',
          agentPhone: settings?.agentPhone || '',
          emailSignature: settings?.emailSignature || `Best regards,\n${settings?.agencyName || 'ViewFlow Concierge Team'}`
        };

        const { renderTemplate, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, DEFAULT_WHATSAPP_BODY } = require('../utils/templateEngine');

        // 1. Send WhatsApp reminder
        if (whatsAppEnabled && viewing.lead.phone) {
          const rawWaTemplate = settings?.whatsappReminderBody?.trim() || DEFAULT_WHATSAPP_BODY;
          const renderedWaMsg = renderTemplate(rawWaTemplate, templateVars);

          await sendWhatsApp({
            to: viewing.lead.phone,
            message: renderedWaMsg,
            settings
          });
        }

        // 2. Send Free Gmail Email reminder
        if (emailEnabled && viewing.lead.email) {
          const rawSubjectTemplate = settings?.emailReminderSubject?.trim() || DEFAULT_EMAIL_SUBJECT;
          const rawBodyTemplate = settings?.emailReminderBody?.trim() || DEFAULT_EMAIL_BODY;

          const renderedSubject = renderTemplate(rawSubjectTemplate, templateVars);
          const renderedBody = renderTemplate(rawBodyTemplate, templateVars);

          // Convert line breaks into HTML paragraphs/breaks for email client rendering
          const formattedHtmlBody = renderedBody
            .split('\n\n')
            .map(para => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #334155;">${para.replace(/\n/g, '<br/>')}</p>`)
            .join('');

          await sendEmail({
            to: viewing.lead.email,
            subject: renderedSubject,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="margin-bottom: 20px;">
                  <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 20px; background-color: #eff6ff; color: #2563eb;">Viewing Reminder</span>
                </div>
                <div style="font-size: 15px; color: #334155;">
                  ${formattedHtmlBody}
                </div>
                <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #2563eb;">
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Property:</strong> ${propertyTitle}</p>
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Date & Time:</strong> ${formattedDate} at ${formattedTime} (${durationStr})</p>
                  <p style="margin: 4px 0; color: #0f172a;"><strong>Location:</strong> ${locationStr}</p>
                </div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                  Sent via ${settings?.agencyName || 'ViewFlow'} • Direct Concierge Service
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
