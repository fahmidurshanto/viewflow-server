const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { sendEmail, sendWhatsApp } = require('../services/notificationService');

// GET settings (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    const userQuery = { user: req.user._id };
    let settings = await Settings.findOne(userQuery);
    if (!settings) {
      settings = await Settings.create({
        user: req.user._id,
        agentEmail: req.user.email,
        agencyName: req.user.agencyName || 'ViewFlow Premier Real Estate'
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE settings (Protected - tenant isolated)
router.put('/', protect, async (req, res) => {
  try {
    const userQuery = { user: req.user._id };
    let settings = await Settings.findOne(userQuery);
    if (!settings) {
      settings = new Settings({
        ...req.body,
        user: req.user._id
      });
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEST EMAIL (Free Gmail SMTP - Protected)
router.post('/test-email', protect, async (req, res) => {
  try {
    const { toEmail } = req.body;
    const userQuery = { user: req.user._id };
    const settings = await Settings.findOne(userQuery);

    const recipient = toEmail || req.user.email || settings?.agentEmail;
    const { renderTemplate, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } = require('../utils/templateEngine');

    const sampleVars = {
      clientName: req.user.name || 'Sarah Jenkins (Test Client)',
      propertyTitle: 'Modern Waterfront Luxury Villa',
      viewingDate: new Date(Date.now() + 86400000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      viewingTime: '02:00 PM',
      duration: '45 mins',
      location: '124 Marina Boulevard, Miami, FL',
      agencyName: settings?.agencyName || 'ViewFlow Premier Real Estate',
      agentEmail: settings?.agentEmail || req.user.email || 'agent@viewflow.demo',
      agentPhone: settings?.agentPhone || '+1 (555) 019-2834',
      emailSignature: settings?.emailSignature || `Best regards,\n${settings?.agencyName || 'ViewFlow Concierge Team'}`
    };

    const rawSubject = settings?.emailReminderSubject?.trim() || DEFAULT_EMAIL_SUBJECT;
    const rawBody = settings?.emailReminderBody?.trim() || DEFAULT_EMAIL_BODY;

    const renderedSubject = `[Test] ${renderTemplate(rawSubject, sampleVars)}`;
    const renderedBody = renderTemplate(rawBody, sampleVars);
    const formattedHtmlBody = renderedBody
      .split('\n\n')
      .map(para => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #334155;">${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const result = await sendEmail({
      to: recipient,
      subject: renderedSubject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 20px; background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;">Test Email Delivery</span>
          </div>
          <div style="font-size: 15px; color: #334155;">
            ${formattedHtmlBody}
          </div>
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin: 4px 0; color: #0f172a;"><strong>Property:</strong> ${sampleVars.propertyTitle}</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Date & Time:</strong> ${sampleVars.viewingDate} at ${sampleVars.viewingTime} (${sampleVars.duration})</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Location:</strong> ${sampleVars.location}</p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            This is a test notification demonstrating your customized email template.
          </p>
        </div>
      `,
      settings
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEST WHATSAPP (Protected)
router.post('/test-whatsapp', protect, async (req, res) => {
  try {
    const { toPhone } = req.body;
    const userQuery = { user: req.user._id };
    const settings = await Settings.findOne(userQuery);

    const recipient = toPhone || settings?.agentPhone;
    const { renderTemplate, DEFAULT_WHATSAPP_BODY } = require('../utils/templateEngine');

    const sampleVars = {
      clientName: req.user.name || 'Sarah Jenkins',
      propertyTitle: 'Modern Waterfront Luxury Villa',
      viewingDate: new Date(Date.now() + 86400000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      viewingTime: '02:00 PM',
      duration: '45 mins',
      location: '124 Marina Boulevard, Miami, FL',
      agencyName: settings?.agencyName || 'ViewFlow Premier Real Estate',
      agentEmail: settings?.agentEmail || req.user.email || 'agent@viewflow.demo',
      agentPhone: settings?.agentPhone || '+1 (555) 019-2834',
      emailSignature: settings?.emailSignature || `Best regards,\n${settings?.agencyName || 'ViewFlow Concierge Team'}`
    };

    const rawWaTemplate = settings?.whatsappReminderBody?.trim() || DEFAULT_WHATSAPP_BODY;
    const renderedMsg = renderTemplate(rawWaTemplate, sampleVars);

    const result = await sendWhatsApp({
      to: recipient,
      message: `🔔 [Test Alert] ${renderedMsg}`,
      settings
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESET DEMO DATA (Protected)
router.post('/reset-demo', protect, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Demo reset is strictly disabled in production.' });
    }

    const mongoose = require('mongoose');
    const Property = require('../models/Property');
    const Lead = require('../models/Lead');
    const Viewing = require('../models/Viewing');
    const Task = require('../models/Task');
    const ActivityLog = require('../models/ActivityLog');

    const userId = req.user._id;
    const filter = { user: userId };

    if (mongoose.connection.readyState === 1) {
      // Clear ONLY current tenant's data
      await Property.deleteMany(filter);
      await Lead.deleteMany(filter);
      await Viewing.deleteMany(filter);
      await Task.deleteMany(filter);
      await ActivityLog.deleteMany(filter);

      // 1. Properties
      const properties = await Property.insertMany([
        {
          user: userId,
          title: 'Modern Waterfront Luxury Villa',
          description: 'Breathtaking 4-bedroom villa with panoramic bay views, private pool, and smart home automation.',
          price: 850000,
          type: 'Sale',
          propertyType: 'Villa',
          status: 'Available',
          address: {
            street: '124 Marina Boulevard',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101'
          },
          specs: { bedrooms: 4, bathrooms: 3, areaSqFt: 3400 },
          images: [
            'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80'
          ],
          featured: true
        },
        {
          user: userId,
          title: 'Penthouse Apartment in Financial District',
          description: 'Exquisite 2-bed penthouse with 12ft floor-to-ceiling windows and direct skyline views.',
          price: 3600,
          type: 'Rent',
          propertyType: 'Apartment',
          status: 'Under Offer',
          address: {
            street: '45 Wall Street, Apt 38A',
            city: 'New York',
            state: 'NY',
            zipCode: '10005'
          },
          specs: { bedrooms: 2, bathrooms: 2, areaSqFt: 1550 },
          images: [
            'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
          ],
          featured: true
        },
        {
          user: userId,
          title: 'Charming Suburban Family Home',
          description: 'Quiet neighborhood home featuring a spacious backyard, modern kitchen, and garage for 2 cars.',
          price: 495000,
          type: 'Sale',
          propertyType: 'House',
          status: 'Available',
          address: {
            street: '782 Maple Ridge Lane',
            city: 'Austin',
            state: 'TX',
            zipCode: '78704'
          },
          specs: { bedrooms: 3, bathrooms: 2, areaSqFt: 2200 },
          images: [
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
          ],
          featured: false
        },
        {
          user: userId,
          title: 'Downtown Tech Loft & Studio',
          description: 'Industrial chic loft with brick accent walls, high ceilings, and walk-to-work location.',
          price: 2400,
          type: 'Rent',
          propertyType: 'Studio',
          status: 'Sold/Let',
          address: {
            street: '210 King Street',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94107'
          },
          specs: { bedrooms: 1, bathrooms: 1, areaSqFt: 980 },
          images: [
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
          ],
          featured: false
        }
      ]);

      // 2. Leads
      const leads = await Lead.insertMany([
        {
          user: userId,
          name: 'Sarah Jenkins',
          email: 'sarah.j@example.com',
          phone: '+1 (555) 234-5678',
          stage: 'Viewing',
          budget: 900000,
          preferredLocation: 'Miami, FL',
          interestedProperty: properties[0]._id,
          notes: 'Pre-approved mortgage. Wants close to international schools.',
          source: 'Website'
        },
        {
          user: userId,
          name: 'Michael Chang',
          email: 'm.chang@example.com',
          phone: '+1 (555) 876-5432',
          stage: 'Offer',
          budget: 3800,
          preferredLocation: 'New York, NY',
          interestedProperty: properties[1]._id,
          notes: 'Submitted offer of $3,500/month for 18-month lease.',
          source: 'Portal'
        },
        {
          user: userId,
          name: 'David & Emma Vance',
          email: 'vance.family@example.com',
          phone: '+1 (555) 345-6789',
          stage: 'Contacted',
          budget: 520000,
          preferredLocation: 'Austin, TX',
          interestedProperty: properties[2]._id,
          notes: 'Requested virtual tour video and neighborhood crime stats.',
          source: 'Referral'
        },
        {
          user: userId,
          name: 'Robert Sterling',
          email: 'robert@sterlingholdings.com',
          phone: '+1 (555) 901-2345',
          stage: 'Enquiry',
          budget: 1200000,
          preferredLocation: 'Miami Bay',
          interestedProperty: properties[0]._id,
          notes: 'Investor looking for high rental yield property.',
          source: 'Walk-in'
        }
      ]);

      // 3. Viewings
      const today = new Date();
      const tomorrow10am = new Date(today);
      tomorrow10am.setDate(tomorrow10am.getDate() + 1);
      tomorrow10am.setHours(10, 0, 0, 0);

      const dayAfter2pm = new Date(today);
      dayAfter2pm.setDate(dayAfter2pm.getDate() + 2);
      dayAfter2pm.setHours(14, 0, 0, 0);

      await Viewing.insertMany([
        {
          user: userId,
          property: properties[0]._id,
          lead: leads[0]._id,
          scheduledDate: tomorrow10am,
          durationMinutes: 45,
          status: 'Scheduled',
          notes: 'First time viewing with client'
        },
        {
          user: userId,
          property: properties[2]._id,
          lead: leads[2]._id,
          scheduledDate: dayAfter2pm,
          durationMinutes: 45,
          status: 'Scheduled',
          notes: 'Second viewing, bringing their contractor'
        }
      ]);

      // 4. Tasks
      await Task.insertMany([
        {
          user: userId,
          title: 'Send HOA documents to Sarah Jenkins',
          dueDate: tomorrow10am,
          priority: 'High',
          status: 'Pending',
          relatedLead: leads[0]._id,
          relatedProperty: properties[0]._id
        },
        {
          user: userId,
          title: 'Review Counter-offer with Landlord for Apt 38A',
          dueDate: today,
          priority: 'High',
          status: 'In Progress',
          relatedLead: leads[1]._id,
          relatedProperty: properties[1]._id
        },
        {
          user: userId,
          title: 'Confirm Austin Viewing with David & Emma',
          dueDate: dayAfter2pm,
          priority: 'Medium',
          status: 'Pending',
          relatedLead: leads[2]._id,
          relatedProperty: properties[2]._id
        }
      ]);

      // 5. Activity Logs
      await ActivityLog.insertMany([
        {
          user: userId,
          lead: leads[0]._id,
          type: 'Call',
          note: 'Initial phone call to qualify budget ($900k) and timeline. Confirmed Viewing for tomorrow 10:00 AM.',
          author: 'Lead Agent'
        },
        {
          user: userId,
          lead: leads[1]._id,
          type: 'Stage Changed',
          note: 'Moved to "Offer" stage after receiving written intent to lease.',
          author: 'Lead Agent'
        }
      ]);

      return res.json({ success: true, message: 'Demo data successfully refreshed!' });
    }

    res.json({ success: true, message: 'Demo data simulated (In-memory mode).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
