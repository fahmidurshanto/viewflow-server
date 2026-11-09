const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Viewing = require('../models/Viewing');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const ActivityLog = require('../models/ActivityLog');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { sendEmail, sendWhatsApp } = require('../services/notificationService');

// GET viewings (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let query = { user: req.user._id };
    if (status) query.status = status;
    const viewings = await Viewing.find(query)
      .populate('property')
      .populate('lead')
      .sort({ scheduledDate: 1 });
    res.json(viewings);
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

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE viewing (Protected - Agent/Dashboard booking with double-booking collision prevention)
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

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE viewing status & feedback (Protected - ownership verified)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, feedback } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Viewing not found' });
    }

    const updateFields = {};
    if (status) updateFields.status = status;
    if (feedback !== undefined) updateFields.feedback = feedback;

    const updated = await Viewing.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateFields,
      { new: true }
    ).populate('property lead');

    if (!updated) {
      return res.status(404).json({ error: 'Viewing not found or access denied' });
    }

    // Auto-update lead stage when viewing is completed
    if (status === 'Completed' && updated.lead) {
      const currentLead = await Lead.findById(updated.lead._id || updated.lead);
      if (currentLead && currentLead.stage === 'Viewing') {
        currentLead.stage = 'Offer';
        await currentLead.save();

        await ActivityLog.create({
          user: req.user._id,
          lead: currentLead._id,
          property: updated.property?._id || updated.property,
          viewing: updated._id,
          type: 'Stage Changed',
          title: 'Lead Advanced to Offer',
          note: `Viewing marked completed. Lead automatically advanced to Offer stage.`,
          author: req.user.name || 'System',
          isRead: false
        });
      }
    }

    await ActivityLog.create({
      user: req.user._id,
      lead: updated.lead?._id || updated.lead,
      property: updated.property?._id || updated.property,
      viewing: updated._id,
      type: status === 'Completed' ? 'Viewing Completed' : 'General',
      title: `Viewing marked as ${status}`,
      note: feedback ? `Status: ${status}. Feedback: "${feedback}"` : `Status updated to ${status}`,
      author: req.user.name || 'Agent',
      isRead: false
    });

    res.json(updated);
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

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const startTime = new Date(scheduledDate);
    const duration = Number(durationMinutes) || 45;
    const endTime = new Date(startTime.getTime() + duration * 60000);

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
      if (leadDoc.stage === 'Enquiry' || leadDoc.stage === 'Contacted') {
        leadDoc.stage = 'Viewing';
      }
      if (notes) {
        leadDoc.notes = (leadDoc.notes ? leadDoc.notes + '\n\n' : '') + `[Public Booking Note]: ${notes}`;
      }
      if (!leadDoc.phone && phone) {
        leadDoc.phone = phone;
      }
      await leadDoc.save();
    }

    const viewing = new Viewing({
      property: propertyId,
      lead: leadDoc._id,
      scheduledDate: startTime,
      durationMinutes: duration,
      status: 'Scheduled',
      reminderSent: false,
      user: propertyDoc.user || null
    });

    const savedViewing = await viewing.save();

    // Log Activity for Agent
    await ActivityLog.create({
      user: propertyDoc.user || null,
      lead: leadDoc._id,
      property: propertyId,
      viewing: savedViewing._id,
      type: 'Viewing Booked',
      title: 'New Online Client Booking',
      note: `${name} scheduled a self-service viewing for ${new Date(startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`,
      author: 'Client (Portal)',
      isRead: false
    });

    // Send immediate confirmation email to client
    const userQuery = propertyDoc.user ? { user: propertyDoc.user } : {};
    const settings = await Settings.findOne(userQuery);

    const formattedDate = startTime.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const locationStr = propertyDoc.address
      ? `${propertyDoc.address.street || ''}${propertyDoc.address.city ? ', ' + propertyDoc.address.city : ''}`.trim() || 'Property Location'
      : 'Property Location';

    sendEmail({
      to: email,
      subject: `Viewing Confirmed: ${propertyDoc.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Appointment Confirmed 🎉</h2>
          <p style="font-size: 15px; color: #334155;">Hello <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #334155;">Your viewing appointment for <strong>${propertyDoc.title}</strong> has been successfully booked!</p>
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 4px 0; color: #0f172a;"><strong>Property:</strong> ${propertyDoc.title}</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Date & Time:</strong> ${formattedDate} at ${formattedTime}</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Duration:</strong> ${duration} minutes</p>
            <p style="margin: 4px 0; color: #0f172a;"><strong>Address:</strong> ${locationStr}</p>
          </div>
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

    res.status(201).json({
      success: true,
      message: 'Viewing appointment booked successfully!',
      viewing: populatedViewing || savedViewing
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
