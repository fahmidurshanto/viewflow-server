const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const store = require('../config/mockStore');
const { protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET all tasks (Protected - tenant isolated)
router.get('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status } = req.query;
      let query = { user: req.user._id };
      if (status) query.status = status;
      const tasks = await Task.find(query)
        .populate('relatedLead')
        .populate('relatedProperty')
        .sort({ dueDate: 1 });
      return res.json(tasks);
    }
    const filtered = store.tasks.filter(t => !t.user || String(t.user) === String(req.user._id));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE task (Protected)
router.post('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const taskData = {
        ...req.body,
        user: req.user._id
      };
      const task = new Task(taskData);
      const saved = await task.save();
      return res.status(201).json(saved);
    }
    const newTask = {
      _id: `task-${Date.now()}`,
      ...req.body,
      user: req.user._id
    };
    store.tasks.unshift(newTask);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE task (Protected - ownership verified)
router.put('/:id', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const updated = await Task.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ error: 'Task not found or access denied' });
      }
      return res.json(updated);
    }
    const t = store.tasks.find((item) => item._id === req.params.id);
    if (t) {
      Object.assign(t, req.body);
      return res.json(t);
    }
    res.status(404).json({ error: 'Task not found' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE task (Protected - ownership verified)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const deleted = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found or access denied' });
      }
      return res.json({ success: true, message: 'Task deleted successfully' });
    }
    store.tasks = store.tasks.filter((t) => t._id !== req.params.id);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
