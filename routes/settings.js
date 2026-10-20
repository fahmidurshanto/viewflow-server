const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { optionalAuth } = require('../middleware/auth');
const { sendEmail, sendWhatsApp } = require('../services/notificationService');

// GET settings
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userQuery = req.user ? { user: req.user._id } : {};
    let settings = await Settings.findOne(userQuery);
    if (!settings) {
      settings = await Settings.create({
        user: req.user ? req.user._id : undefined,
        agentEmail: req.user ? req.user.email : 'admin@viewflow.demo',
        agencyName: req.user?.company || 'ViewFlow Premier Real Estate'
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE settings
router.put('/', optionalAuth, async (req, res) => {
  try {
    const userQuery = req.user ? { user: req.user._id } : {};
    let settings = await Settings.findOne(userQuery);
    if (!settings) {
      settings = new Settings({
        ...req.body,
        user: req.user ? req.user._id : undefined
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

// TEST EMAIL (Free Gmail SMTP)
router.post('/test-email', optionalAuth, async (req, res) => {
  try {
    const { toEmail } = req.body;
    const userQuery = req.user ? { user: req.user._id } : {};
    const settings = await Settings.findOne(userQuery);

    const recipient = toEmail || req.user?.email || settings?.agentEmail || 'test@example.com';
    const result = await sendEmail({
      to: recipient,
      subject: `[Test] Free Email Notification from ${settings?.agencyName || 'ViewFlow'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #2563eb; margin-top: 0;">ViewFlow Free Email Delivery Verified</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Success! Your free email notification system via Gmail SMTP is connected and active.
          </p>
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin: 4px 0; color: #0f172a;"><strong>Agency:</strong> ${settings?.agencyName || 'ViewFlow Premier Real Estate'}</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; white-space: pre-line;">
            ${settings?.emailSignature || 'Best regards,\nViewFlow Concierge Team'}
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

// TEST WHATSAPP
router.post('/test-whatsapp', optionalAuth, async (req, res) => {
  try {
    const { toPhone } = req.body;
    const userQuery = req.user ? { user: req.user._id } : {};
    const settings = await Settings.findOne(userQuery);

    const recipient = toPhone || settings?.agentPhone;
    const result = await sendWhatsApp({
      to: recipient,
      message: `🔔 [ViewFlow Alert] WhatsApp integration is active for ${settings?.agencyName || 'your agency'}! Viewing appointments will trigger instant mobile alerts.`,
      settings
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESET DEMO DATA
router.post('/reset-demo', optionalAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Property = require('../models/Property');
    const Lead = require('../models/Lead');
    const Viewing = require('../models/Viewing');
    const Task = require('../models/Task');
    const ActivityLog = require('../models/ActivityLog');

    const userId = req.user ? req.user._id : null;
    const filter = userId ? { user: userId } : {};

    if (mongoose.connection.readyState === 1) {
      // Clear current tenant's data or all demo data if unauthenticated
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
