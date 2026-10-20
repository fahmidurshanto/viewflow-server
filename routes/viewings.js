const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Viewing = require('../models/Viewing');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const store = require('../config/mockStore');
const { optionalAuth, protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET viewings
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status } = req.query;
      let query = {};
      if (req.user) {
        // Strict multi-tenant isolation: Only user's own viewings
        query.user = req.user._id;
      }
      if (status) query.status = status;
      const viewings = await Viewing.find(query)
        .populate('property')
        .populate('lead')
        .sort({ scheduledDate: 1 });
      return res.json(viewings);
    }
    res.json(store.viewings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET availability for a property on a given date
router.get('/availability', async (req, res) => {
  try {
    const { propertyId, date } = req.query;
    if (!propertyId || !date) {
      return res.status(400).json({ error: 'propertyId and date are required query parameters' });
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    if (isDbConnected()) {
      const bookedViewings = await Viewing.find({
        property: propertyId,
        status: { $in: ['Scheduled', 'Confirmed'] },
        scheduledDate: { $gte: startOfDay, $lte: endOfDay }
      }).select('scheduledDate durationMinutes status');

      const occupiedSlots = bookedViewings.map((v) => {
        const start = new Date(v.scheduledDate);
        const end = new Date(start.getTime() + (v.durationMinutes || 45) * 60000);
        return {
          id: v._id,
          start: start.toISOString(),
          end: end.toISOString(),
          durationMinutes: v.durationMinutes || 45,
          timeString: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });

      return res.json({ propertyId, date, occupiedSlots });
    }

    // Mock fallback
    const occupiedSlots = store.viewings
      .filter((v) => {
        const propId = typeof v.property === 'object' ? v.property._id : v.property;
        if (String(propId) !== String(propertyId) || v.status === 'Cancelled') return false;
        const vDate = new Date(v.scheduledDate).toISOString().split('T')[0];
        return vDate === date;
      })
      .map((v) => {
        const start = new Date(v.scheduledDate);
        return {
          id: v._id,
          start: start.toISOString(),
          end: new Date(start.getTime() + (v.durationMinutes || 45) * 60000).toISOString(),
          durationMinutes: v.durationMinutes || 45,
          timeString: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });

    res.json({ propertyId, date, occupiedSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE viewing (with robust collision check)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { property, lead, scheduledDate, durationMinutes } = req.body;
    if (!property || !lead || !scheduledDate) {
      return res.status(400).json({ error: 'Missing required fields (property, lead, scheduledDate)' });
    }

    const startTime = new Date(scheduledDate);
    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledDate format' });
    }

    const duration = Number(durationMinutes) || 45;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (isDbConnected()) {
      const activeViewings = await Viewing.find({
        property,
        status: { $in: ['Scheduled', 'Confirmed'] }
      }).populate('lead property');

      const conflicting = activeViewings.find((v) => {
        const vStart = new Date(v.scheduledDate).getTime();
        const vEnd = vStart + (v.durationMinutes || 45) * 60000;
        return startTime.getTime() < vEnd && endTime.getTime() > vStart;
      });

      if (conflicting) {
        const conflictTime = new Date(conflicting.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(409).json({
          error: 'Double-booking Conflict',
          message: `Double Booking Detected! ${conflicting.property?.title || 'This property'} is already reserved around ${conflictTime} (${conflicting.durationMinutes || 45} mins). Please choose an available time slot.`
        });
      }

      const viewingData = {
        property,
        lead,
        scheduledDate: startTime,
        durationMinutes: duration,
        status: 'Scheduled'
      };
      if (req.user) {
        viewingData.user = req.user._id;
      }

      const viewing = new Viewing(viewingData);
      const saved = await viewing.save();

      const targetLead = await Lead.findById(lead);
      if (targetLead && (targetLead.stage === 'Enquiry' || targetLead.stage === 'Contacted')) {
        targetLead.stage = 'Viewing';
        await targetLead.save();
      }

      return res.status(201).json(saved);
    }

    // Fallback collision check for mock store
    const propId = typeof property === 'object' ? property._id : property;
    const conflicting = store.viewings.find((v) => {
      const vPropId = typeof v.property === 'object' ? v.property._id : v.property;
      if (String(vPropId) !== String(propId) || v.status === 'Cancelled') return false;
      const vStart = new Date(v.scheduledDate).getTime();
      const vEnd = vStart + (v.durationMinutes || 45) * 60000;
      return startTime.getTime() < vEnd && endTime.getTime() > vStart;
    });

    if (conflicting) {
      return res.status(409).json({
        error: 'Double-booking Conflict',
        message: `This property is already booked for a viewing at this time. Please select a different time slot.`
      });
    }

    const matchedProp = store.properties.find((p) => p._id === propId) || store.properties[0];
    const leadId = typeof lead === 'object' ? lead._id : lead;
    const matchedLead = store.leads.find((l) => l._id === leadId) || store.leads[0];

    const newViewing = {
      _id: `viewing-${Date.now()}`,
      property: matchedProp,
      lead: matchedLead,
      scheduledDate: startTime.toISOString(),
      durationMinutes: duration,
      status: 'Scheduled',
      reminderSent: false,
      createdAt: new Date().toISOString()
    };
    store.viewings.unshift(newViewing);

    if (matchedLead && (matchedLead.stage === 'Enquiry' || matchedLead.stage === 'Contacted')) {
      matchedLead.stage = 'Viewing';
    }

    res.status(201).json(newViewing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE viewing status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, feedback } = req.body;
    if (isDbConnected()) {
      const updated = await Viewing.findByIdAndUpdate(
        req.params.id,
        { status, feedback },
        { new: true }
      ).populate('property lead');
      return res.json(updated);
    }

    const v = store.viewings.find((item) => item._id === req.params.id);
    if (v) {
      if (status) v.status = status;
      if (feedback) v.feedback = feedback;
      return res.json(v);
    }
    res.status(404).json({ error: 'Viewing not found' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/viewings/public-book - Public client-facing booking endpoint (No auth required)
router.post('/public-book', async (req, res) => {
  try {
    const { propertyId, name, email, phone, scheduledDate, durationMinutes, notes } = req.body;

    if (!propertyId || !name || !email || !scheduledDate) {
      return res.status(400).json({ error: 'Property, name, email, and scheduledDate are required' });
    }

    const startTime = new Date(scheduledDate);
    const duration = Number(durationMinutes) || 45;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (isDbConnected()) {
      const Property = require('../models/Property');
      const propertyDoc = await Property.findById(propertyId);
      if (!propertyDoc) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Check collision for this property
      const conflicting = await Viewing.findOne({
        property: propertyId,
        status: { $ne: 'Cancelled' },
        scheduledDate: {
          $lt: endTime,
          $gt: new Date(startTime.getTime() - duration * 60000)
        }
      });

      if (conflicting) {
        return res.status(409).json({
          error: 'Double-booking Conflict',
          message: 'Sorry! This time slot is already reserved. Please choose another slot.'
        });
      }

      // Find or create lead
      let leadDoc = await Lead.findOne({ email, user: propertyDoc.user || null });
      if (!leadDoc) {
        leadDoc = new Lead({
          name,
          email,
          phone: phone || '',
          stage: 'Viewing',
          budget: propertyDoc.price || 0,
          preferredLocation: propertyDoc.address?.city || '',
          interestedProperty: propertyId,
          notes: notes ? `Self-booked from client link: ${notes}` : 'Self-booked from public client link',
          source: 'Website',
          user: propertyDoc.user || null
        });
        await leadDoc.save();
      } else {
        leadDoc.stage = 'Viewing';
        leadDoc.interestedProperty = propertyId;
        await leadDoc.save();
      }

      // Create Viewing
      const viewing = new Viewing({
        property: propertyId,
        lead: leadDoc._id,
        scheduledDate: startTime,
        durationMinutes: duration,
        status: 'Scheduled',
        user: propertyDoc.user || null
      });
      const savedViewing = await viewing.save();
      // Dispatch instant booking confirmation email & WhatsApp
      const Settings = require('../models/Settings');
      const { sendEmail, sendWhatsApp } = require('../services/notificationService');
      const settings = await Settings.findOne(propertyDoc.user ? { user: propertyDoc.user } : {});

      const formattedDate = startTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Send confirmation email
      sendEmail({
        to: email,
        subject: `Viewing Confirmed: ${propertyDoc.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #2563eb; margin-top: 0;">Viewing Appointment Confirmed!</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              Hi ${name}, your viewing request for <strong>${propertyDoc.title}</strong> has been successfully booked in our calendar.
            </p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 4px 0; color: #0f172a;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0; color: #0f172a;"><strong>Time:</strong> ${formattedTime} (${duration} mins)</p>
              <p style="margin: 4px 0; color: #0f172a;"><strong>Location:</strong> ${propertyDoc.address?.street || ''}, ${propertyDoc.address?.city || ''}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">
              Our agent will be on-site to greet you. If you need any assistance, feel free to reply directly to this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 11px; margin-bottom: 0;">
              ${settings?.agencyName || 'ViewFlow Premier Real Estate'} • Booking Reference: #${viewing._id.toString().slice(-6)}
            </p>
          </div>
        `,
        settings
      }).catch(err => console.error('Booking confirmation email error:', err));

      // Send confirmation WhatsApp alert
      if (phone) {
        sendWhatsApp({
          to: phone,
          message: `Hi ${name}! Your viewing for ${propertyDoc.title} is confirmed for ${formattedDate} at ${formattedTime}. - ${settings?.agencyName || 'ViewFlow'}`,
          settings
        }).catch(err => console.error('Booking confirmation WhatsApp error:', err));
      }

      return res.status(201).json({
        success: true,
        message: 'Viewing appointment booked successfully!',
        viewing: populated
      });
    }

    // Mock store fallback
    const prop = store.properties.find(p => p._id === propertyId) || store.properties[0];
    const newLead = {
      _id: `lead-${Date.now()}`,
      name,
      email,
      phone: phone || '',
      stage: 'Viewing',
      budget: prop.price || 0,
      preferredLocation: prop.address?.city || '',
      source: 'Website',
      createdAt: new Date().toISOString()
    };
    store.leads.unshift(newLead);

    const newViewing = {
      _id: `viewing-${Date.now()}`,
      property: prop,
      lead: newLead,
      scheduledDate: startTime.toISOString(),
      durationMinutes: duration,
      status: 'Scheduled',
      reminderSent: false,
      createdAt: new Date().toISOString()
    };
    store.viewings.unshift(newViewing);

    res.status(201).json({
      success: true,
      message: 'Viewing appointment booked successfully!',
      viewing: newViewing
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
