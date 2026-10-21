/**
 * Interpolates dynamic variables into template strings.
 * Example: "Hi {clientName}, viewing at {viewingTime}" -> "Hi Sarah, viewing at 10:00 AM"
 */
const DEFAULT_EMAIL_SUBJECT = 'Reminder: Upcoming Viewing for {propertyTitle} at {viewingTime}';

const DEFAULT_EMAIL_BODY = `Dear {clientName},

This is a friendly reminder that your private property viewing is scheduled for today.

Viewing Details:
• Property: {propertyTitle}
• Date: {viewingDate}
• Time: {viewingTime} ({duration})
• Location: {location}

If you need to reschedule or have any questions ahead of time, please reply directly to this email or call {agentPhone}.

{emailSignature}`;

const DEFAULT_WHATSAPP_BODY = `Hi {clientName}! Friendly reminder from {agencyName}: your property viewing for "{propertyTitle}" is scheduled for today at {viewingTime}. Location: {location}. See you there!`;

const renderTemplate = (template, variables = {}) => {
  if (!template || typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : match;
  });
};

module.exports = {
  renderTemplate,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
  DEFAULT_WHATSAPP_BODY
};
