const nodemailer = require('nodemailer');

/**
 * Dispatch an email notification using 100% FREE Gmail SMTP.
 * No domain verification or paid subscriptions required.
 * Allows sending real emails directly to any Gmail, Yahoo, Outlook, or corporate inbox.
 */
const sendEmail = async ({ to, subject, html, settings }) => {
  if (!to) return { success: false, reason: 'No recipient email specified' };

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD; // Google 16-character App Password

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass.replace(/\s+/g, '') // strip accidental spaces
        }
      });

      const agency = settings?.agencyName || 'ViewFlow Real Estate';
      const info = await transporter.sendMail({
        from: `"${agency}" <${gmailUser}>`,
        to,
        subject,
        html
      });

      return { success: true, provider: 'gmail_smtp', messageId: info.messageId };
    } catch (err) {
      console.error('[Gmail SMTP Error]:', err.message);
      return { success: false, provider: 'gmail_smtp', error: err.message };
    }
  }

  // Graceful simulation when credentials are not yet entered
  console.log(`📧 [FREE EMAIL DISPATCH (SIMULATED)] To: "${to}" | Subject: "${subject}"`);
  return {
    success: true,
    simulated: true,
    message: `Email notification sent (Simulated). Add GMAIL_USER & GMAIL_APP_PASSWORD to .env for real delivery.`
  };
};

/**
 * Dispatch an instant mobile alert via WhatsApp using CallMeBot Free API.
 * Completely free, no credit card or business account required.
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
const sendWhatsApp = async ({ to, message, settings }) => {
  const targetPhone = to || process.env.WHATSAPP_PHONE || settings?.agentPhone;
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (targetPhone && apiKey) {
    try {
      // Clean phone number (must be international format e.g. +8801700000000 or 8801700000000)
      const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(message);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${apiKey}`;

      const res = await fetch(url);
      const text = await res.text();

      if (res.ok && (text.includes('Message Queued') || text.includes('Success') || text.includes('Message Sent'))) {
        return { success: true, provider: 'whatsapp' };
      }
      return { success: false, provider: 'whatsapp', error: text || 'WhatsApp API request failed' };
    } catch (err) {
      console.error('[WhatsApp Error]:', err.message);
      return { success: false, provider: 'whatsapp', error: err.message };
    }
  }

  // Safe simulation mode
  console.log(`💬 [FREE WHATSAPP ALERT (SIMULATED)] Phone: "${targetPhone || 'Default'}" | Text: "${message}"`);
  return {
    success: true,
    simulated: true,
    message: `WhatsApp alert logged (Simulated). Add WHATSAPP_API_KEY in .env for live messages.`
  };
};

module.exports = { sendEmail, sendWhatsApp };
