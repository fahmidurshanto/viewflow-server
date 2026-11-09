const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// GET all tasks (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let query = { user: req.user._id };
    if (status) query.status = status;
    const tasks = await Task.find(query)
      .populate('relatedLead')
      .populate('relatedProperty')
      .sort({ dueDate: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE task (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      user: req.user._id
    };
    const task = new Task(taskData);
    const saved = await task.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE task (Protected - ownership verified)
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const updated = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE task (Protected - ownership verified)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const deleted = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
