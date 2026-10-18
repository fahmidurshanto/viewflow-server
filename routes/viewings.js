const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Viewing = require('../models/Viewing');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const store = require('../config/mockStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET viewings
router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status } = req.query;
      let query = {};
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

// CREATE viewing (with collision check)
router.post('/', async (req, res) => {
  try {
    const { property, lead, scheduledDate, durationMinutes } = req.body;
    const startTime = new Date(scheduledDate);
    const duration = durationMinutes || 45;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (isDbConnected()) {
      const bufferBefore = new Date(startTime.getTime() - 45 * 60000);
      const bufferAfter = new Date(endTime.getTime());

      const conflicting = await Viewing.findOne({
        property,
        status: { $ne: 'Cancelled' },
        scheduledDate: { $gte: bufferBefore, $lte: bufferAfter }
      }).populate('lead');

      if (conflicting) {
        return res.status(409).json({
          error: 'Double-booking Conflict',
          message: `This property is already booked for a viewing at this time with client: ${conflicting.lead?.name || 'Another client'}. Please select a different time slot.`
        });
      }

      const viewing = new Viewing({
        property,
        lead,
        scheduledDate: startTime,
        durationMinutes: duration,
        status: 'Scheduled'
      });
      const saved = await viewing.save();

      const targetLead = await Lead.findById(lead);
      if (targetLead && (targetLead.stage === 'Enquiry' || targetLead.stage === 'Contacted')) {
        targetLead.stage = 'Viewing';
        await targetLead.save();
      }

      return res.status(201).json(saved);
    }

    // Fallback collision check
    const propId = typeof property === 'object' ? property._id : property;
    const conflicting = store.viewings.find((v) => {
      if (v.property._id !== propId || v.status === 'Cancelled') return false;
      const vTime = new Date(v.scheduledDate).getTime();
      return Math.abs(vTime - startTime.getTime()) < 45 * 60000;
    });

    if (conflicting) {
      return res.status(409).json({
        error: 'Double-booking Conflict',
        message: `This property is already booked for a viewing at this time with client: ${conflicting.lead?.name || 'Another client'}. Please select a different time slot.`
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

module.exports = router;
