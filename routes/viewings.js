const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Viewing = require('../models/Viewing');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const store = require('../config/mockStore');
const { optionalAuth, protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET viewings (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status } = req.query;
      let query = { user: req.user._id };
      if (status) query.status = status;
      const viewings = await Viewing.find(query)
        .populate('property')
        .populate('lead')
        .sort({ scheduledDate: 1 });
      return res.json(viewings);
    }
    const filtered = store.viewings.filter(v => !v.user || String(v.user) === String(req.user._id));
    res.json(filtered);
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

    if (isDbConnected() && mongoose.isValidObjectId(propertyId)) {
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

      const standardTimes = [
        '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
        '05:00 PM', '06:00 PM'
      ];

      const slots = standardTimes.map((timeStr) => {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const slotStart = new Date(`${date}T00:00:00.000Z`);
        slotStart.setUTCHours(hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 45 * 60000);

        const isOccupied = occupiedSlots.some((occ) => {
          const occStart = new Date(occ.start).getTime();
          const occEnd = new Date(occ.end).getTime();
          return slotStart.getTime() < occEnd && slotEnd.getTime() > occStart;
        });

        return {
          time: timeStr,
          available: !isOccupied
        };
      });

      return res.json({ propertyId, date, occupiedSlots, slots });
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

    const standardTimes = [
      '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
      '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
      '05:00 PM', '06:00 PM'
    ];

    const slots = standardTimes.map((timeStr) => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const slotStart = new Date(`${date}T00:00:00.000Z`);
      slotStart.setUTCHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 45 * 60000);

      const isOccupied = occupiedSlots.some((occ) => {
        const occStart = new Date(occ.start).getTime();
        const occEnd = new Date(occ.end).getTime();
        return slotStart.getTime() < occEnd && slotEnd.getTime() > occStart;
      });

      return {
        time: timeStr,
        available: !isOccupied
      };
    });

    res.json({ propertyId, date, occupiedSlots, slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE viewing (Protected - with collision check)
router.post('/', protect, async (req, res) => {
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
        status: 'Scheduled',
        user: req.user._id
      };

      const viewing = new Viewing(viewingData);
      const saved = await viewing.save();

      const targetLead = await Lead.findById(lead);
      if (targetLead && (targetLead.stage === 'Enquiry' || targetLead.stage === 'Contacted')) {
        targetLead.stage = 'Viewing';
        await targetLead.save();
      }

      // Log activity
      await ActivityLog.create({
        user: req.user._id,
        lead: saved.lead,
        property: saved.property,
        viewing: saved._id,
        type: 'Viewing Booked',
        title: 'New Viewing Scheduled',
        note: `Viewing scheduled for ${new Date(saved.scheduledDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`,
        author: req.user.name || 'Agent',
        isRead: false
      });

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

// UPDATE viewing status & feedback (Protected - ownership verified)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, feedback, autoAdvanceLead } = req.body;
    if (isDbConnected()) {
      const updateData = {};
      if (status) updateData.status = status;
      if (feedback) updateData.feedback = feedback;

      const updated = await Viewing.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        updateData,
        { new: true }
      ).populate('property lead');

      if (!updated) {
        return res.status(404).json({ error: 'Viewing not found or access denied' });
      }

      // If client feedback indicates offer interest or requested auto-advance, update Lead stage
      if (updated.lead && (feedback?.interestedInOffer || autoAdvanceLead)) {
        const Lead = require('../models/Lead');
        await Lead.findByIdAndUpdate(updated.lead._id, {
          stage: 'Offer',
          notes: feedback?.comments ? `Offer interest recorded after viewing: ${feedback.comments}` : undefined
        });
      }

      // Log Activity
      await ActivityLog.create({
        user: req.user._id,
        lead: updated.lead?._id,
        property: updated.property?._id,
        viewing: updated._id,
        type: status === 'Completed' ? 'Viewing Completed' : 'Viewing Note',
        title: status === 'Completed' ? 'Viewing Completed & Feedback Logged' : `Viewing Status: ${status}`,
        note: feedback?.comments 
          ? `Status marked as "${status}". Rating: ${feedback.rating || 'N/A'}★. Feedback: "${feedback.comments}". Interested in offer: ${feedback.interestedInOffer ? 'Yes' : 'No'}`
          : `Viewing status updated to "${status}"`,
        author: req.user.name || 'Agent',
        isRead: false
      });

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

    if (isDbConnected() && mongoose.isValidObjectId(propertyId)) {
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

      // Log activity notification for agent
      await ActivityLog.create({
        user: propertyDoc.user || null,
        lead: leadDoc._id,
        property: propertyDoc._id,
        viewing: savedViewing._id,
        type: 'Viewing Booked',
        title: 'New Client Self-Booking',
        note: `${name} self-booked a viewing for "${propertyDoc.title}" on ${startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        author: name,
        isRead: false
      });

      // Dispatch instant booking confirmation email & WhatsApp
      const Settings = require('../models/Settings');
      const { sendEmail, sendWhatsApp } = require('../services/notificationService');
      const { renderTemplate } = require('../utils/templateEngine');
      const settings = await Settings.findOne(propertyDoc.user ? { user: propertyDoc.user } : {});

      const formattedDate = startTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const durationStr = `${duration} mins`;
      const locationStr = propertyDoc.address
        ? `${propertyDoc.address.street || ''}${propertyDoc.address.city ? ', ' + propertyDoc.address.city : ''}`.trim() || 'Property Location'
        : 'Property Location';

      const templateVars = {
        clientName: name,
        propertyTitle: propertyDoc.title,
        viewingDate: formattedDate,
        viewingTime: formattedTime,
        duration: durationStr,
        location: locationStr,
        agencyName: settings?.agencyName || 'ViewFlow Premier Real Estate',
        agentEmail: settings?.agentEmail || '',
        agentPhone: settings?.agentPhone || '',
        emailSignature: settings?.emailSignature || `Best regards,\n${settings?.agencyName || 'ViewFlow Premier Real Estate'}`
      };

      // Send confirmation email
      sendEmail({
        to: email,
        subject: `Viewing Confirmed: ${propertyDoc.title}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="margin-bottom: 20px;">
              <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 20px; background-color: #ecfdf5; color: #059669;">Booking Confirmed</span>
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Viewing Appointment Confirmed!</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              Hi ${name}, your private viewing appointment for <strong>${propertyDoc.title}</strong> has been successfully confirmed.
            </p>
            <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 4px 0; color: #0f172a;"><strong>Property:</strong> ${propertyDoc.title}</p>
              <p style="margin: 4px 0; color: #0f172a;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0; color: #0f172a;"><strong>Time:</strong> ${formattedTime} (${durationStr})</p>
              <p style="margin: 4px 0; color: #0f172a;"><strong>Location:</strong> ${locationStr}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">
              Our agent will be on-site to greet you. If you need any assistance or need to reschedule, feel free to reply directly to this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
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
          message: `Hi ${name}! Your viewing for ${propertyDoc.title} is confirmed for ${formattedDate} at ${formattedTime}. Location: ${locationStr}. - ${settings?.agencyName || 'ViewFlow'}`,
          settings
        }).catch(err => console.error('Booking confirmation WhatsApp error:', err));
      }

      const populatedViewing = await Viewing.findById(savedViewing._id).populate('property lead');

      return res.status(201).json({
        success: true,
        message: 'Viewing appointment booked successfully!',
        viewing: populatedViewing || savedViewing
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
