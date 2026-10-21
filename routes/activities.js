const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * GET /api/activities
 * Query parameters:
 *  - limit: number of items (default 20)
 *  - unreadOnly: boolean flag
 */
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    if (isDbConnected()) {
      const query = {
        $or: [
          { user: req.user._id },
          { user: { $exists: false } }
        ]
      };

      if (unreadOnly) {
        query.isRead = false;
      }

      const activities = await ActivityLog.find(query)
        .populate('lead', 'name email phone stage')
        .populate('property', 'title address price')
        .populate('viewing', 'scheduledDate status durationMinutes')
        .sort({ createdAt: -1 })
        .limit(limit);

      const unreadCount = await ActivityLog.countDocuments({
        $or: [{ user: req.user._id }, { user: { $exists: false } }],
        isRead: false
      });

      return res.json({ activities, unreadCount });
    }

    // Mock fallback
    res.json({
      activities: [
        {
          _id: 'act-1',
          type: 'Viewing Booked',
          title: 'New Viewing Scheduled',
          note: 'Sarah Jenkins booked a viewing for Modern Luxury Villa',
          author: 'System',
          createdAt: new Date().toISOString(),
          isRead: false
        }
      ],
      unreadCount: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/activities/mark-read
 * Mark all or specific activities as read
 */
router.put('/mark-read', protect, async (req, res) => {
  try {
    const { activityIds } = req.body;

    if (isDbConnected()) {
      const filter = {
        $or: [{ user: req.user._id }, { user: { $exists: false } }]
      };

      if (Array.isArray(activityIds) && activityIds.length > 0) {
        filter._id = { $in: activityIds };
      }

      await ActivityLog.updateMany(filter, { $set: { isRead: true } });
      return res.json({ success: true, message: 'Activities marked as read' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/activities
 * Create custom activity/note
 */
router.post('/', protect, async (req, res) => {
  try {
    const { lead, property, viewing, type, title, note } = req.body;
    if (!note) {
      return res.status(400).json({ error: 'Activity note is required' });
    }

    if (isDbConnected()) {
      const activity = await ActivityLog.create({
        user: req.user._id,
        lead: lead || undefined,
        property: property || undefined,
        viewing: viewing || undefined,
        type: type || 'General',
        title: title || `${type || 'General'} Activity`,
        note,
        author: req.user.name || 'Agent',
        isRead: false
      });

      const populated = await ActivityLog.findById(activity._id)
        .populate('lead', 'name email phone stage')
        .populate('property', 'title address price');

      return res.status(201).json(populated);
    }

    res.status(201).json({
      _id: `act-${Date.now()}`,
      note,
      type: type || 'General',
      author: req.user.name || 'Agent',
      createdAt: new Date().toISOString(),
      isRead: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
