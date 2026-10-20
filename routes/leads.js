const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const store = require('../config/mockStore');
const { optionalAuth, protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET all leads (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { stage, search } = req.query;
      let query = { user: req.user._id };
      if (stage) query.stage = stage;
      if (search) {
        query.$and = [
          { user: req.user._id },
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { phone: { $regex: search, $options: 'i' } }
            ]
          }
        ];
        delete query.user;
      }
      const leads = await Lead.find(query).populate('interestedProperty').sort({ updatedAt: -1 });
      return res.json(leads);
    }

    let results = store.leads.filter(l => !l.user || String(l.user) === String(req.user._id));
    const { stage, search } = req.query;
    if (stage) results = results.filter((l) => l.stage === stage);
    if (search) {
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.email.toLowerCase().includes(search.toLowerCase()) ||
          l.phone.includes(search)
      );
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single lead with activities (Protected - ownership verified)
router.get('/:id', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id }).populate('interestedProperty');
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });
      const activities = await ActivityLog.find({ lead: lead._id }).sort({ createdAt: -1 });
      return res.json({ lead, activities });
    }

    const lead = store.leads.find((l) => l._id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const activities = store.activities.filter((a) => a.lead === lead._id);
    res.json({ lead, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE lead (Protected)
router.post('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const leadData = {
        ...req.body,
        user: req.user._id
      };
      const lead = new Lead(leadData);
      const saved = await lead.save();
      await ActivityLog.create({
        lead: saved._id,
        user: req.user._id,
        type: 'General',
        note: `Lead created from source: ${saved.source || 'Website'}`
      });
      return res.status(201).json(saved);
    }

    const newLead = {
      _id: `lead-${Date.now()}`,
      ...req.body,
      user: req.user._id,
      createdAt: new Date().toISOString()
    };
    store.leads.unshift(newLead);
    store.activities.unshift({
      _id: `act-${Date.now()}`,
      lead: newLead._id,
      type: 'General',
      note: `Lead created from source: ${newLead.source || 'Website'}`,
      author: req.user.name || 'Agent',
      createdAt: new Date().toISOString()
    });
    res.status(201).json(newLead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE stage (Protected - ownership verified)
router.patch('/:id/stage', protect, async (req, res) => {
  try {
    const { stage } = req.body;
    if (isDbConnected()) {
      const oldLead = await Lead.findOne({ _id: req.params.id, user: req.user._id });
      if (!oldLead) return res.status(404).json({ error: 'Lead not found or access denied' });
      const previousStage = oldLead.stage;
      oldLead.stage = stage;
      await oldLead.save();

      await ActivityLog.create({
        lead: oldLead._id,
        user: req.user._id,
        type: 'Stage Changed',
        note: `Pipeline stage moved from "${previousStage}" to "${stage}"`
      });
      return res.json(oldLead);
    }

    const lead = store.leads.find((l) => l._id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const prev = lead.stage;
    lead.stage = stage;

    store.activities.unshift({
      _id: `act-${Date.now()}`,
      lead: lead._id,
      type: 'Stage Changed',
      note: `Pipeline stage moved from "${prev}" to "${stage}"`,
      author: req.user.name || 'Agent',
      createdAt: new Date().toISOString()
    });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADD activity (Protected - ownership verified)
router.post('/:id/activity', protect, async (req, res) => {
  try {
    const { type, note, author } = req.body;
    if (isDbConnected()) {
      const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id });
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

      const activity = await ActivityLog.create({
        lead: lead._id,
        user: req.user._id,
        type: type || 'General',
        note,
        author: author || req.user.name || 'Agent'
      });
      return res.status(201).json(activity);
    }

    const newAct = {
      _id: `act-${Date.now()}`,
      lead: req.params.id,
      type: type || 'General',
      note,
      author: author || req.user.name || 'Agent',
      createdAt: new Date().toISOString()
    };
    store.activities.unshift(newAct);
    res.status(201).json(newAct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
