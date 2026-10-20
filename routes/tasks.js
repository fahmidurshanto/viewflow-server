const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const store = require('../config/mockStore');
const { optionalAuth } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

router.get('/', optionalAuth, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status } = req.query;
      let query = {};
      if (req.user) {
        query.user = req.user._id;
      }
      if (status) query.status = status;
      const tasks = await Task.find(query)
        .populate('relatedLead')
        .populate('relatedProperty')
        .sort({ dueDate: 1 });
      return res.json(tasks);
    }
    res.json(store.tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const task = new Task(req.body);
      const saved = await task.save();
      return res.status(201).json(saved);
    }
    const newTask = {
      _id: `task-${Date.now()}`,
      ...req.body
    };
    store.tasks.unshift(newTask);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      const updated = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

module.exports = router;
