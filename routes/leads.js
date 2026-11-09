const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');

// GET all leads (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
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
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single lead with activities (Protected - ownership verified)
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id }).populate('interestedProperty');
    if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });
    const activities = await ActivityLog.find({ lead: lead._id }).sort({ createdAt: -1 });
    res.json({ lead, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE lead (Protected)
router.post('/', protect, async (req, res) => {
  try {
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
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE stage (Protected - ownership verified)
router.patch('/:id/stage', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const { stage } = req.body;
    const oldLead = await Lead.findOne({ _id: req.params.id, user: req.user._id });
    if (!oldLead) return res.status(404).json({ error: 'Lead not found or access denied' });
    const previousStage = oldLead.stage;
    oldLead.stage = stage;
    await oldLead.save();

    await ActivityLog.create({
      lead: oldLead._id,
      user: req.user._id,
      type: 'Stage Changed',
      title: 'Pipeline Stage Updated',
      note: `Deal moved from "${previousStage}" to "${stage}" for ${oldLead.name}`,
      author: req.user.name || 'Agent',
      isRead: false
    });
    res.json(oldLead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADD activity (Protected - ownership verified)
router.post('/:id/activity', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const { type, note, author } = req.body;
    const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id });
    if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

    const activity = await ActivityLog.create({
      lead: lead._id,
      user: req.user._id,
      type: type || 'General',
      note,
      author: author || req.user.name || 'Agent'
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
