const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const store = require('../config/mockStore');
const { optionalAuth, protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

// GET all properties
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (isDbConnected()) {
      const { status, type, search } = req.query;
      let query = {};
      if (req.user) {
        // Strict multi-tenant isolation: Only user's own properties
        query.user = req.user._id;
      }
      if (status) query.status = status;
      if (type) query.type = type;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'address.city': { $regex: search, $options: 'i' } }
        ];
      }
      const properties = await Property.find(query).sort({ createdAt: -1 });
      return res.json(properties);
    }

    // In-memory fallback
    let results = [...store.properties];
    const { status, type, search } = req.query;
    if (status) results = results.filter((p) => p.status === status);
    if (type) results = results.filter((p) => p.type === type);
    if (search) {
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.address.city.toLowerCase().includes(search.toLowerCase())
      );
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single property
router.get('/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      const property = await Property.findById(req.params.id).populate('user', 'name email phone agencyName');
      if (!property) return res.status(404).json({ error: 'Property not found' });
      return res.json(property);
    }
    const prop = store.properties.find((p) => p._id === req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    res.json(prop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE property
router.post('/', optionalAuth, async (req, res) => {
  try {
    if (isDbConnected()) {
      const propData = { ...req.body };
      if (req.user) {
        propData.user = req.user._id;
      }
      const property = new Property(propData);
      const saved = await property.save();
      return res.status(201).json(saved);
    }
    const newProp = {
      _id: `prop-${Date.now()}`,
      ...req.body,
      user: req.user ? req.user._id : null,
      createdAt: new Date().toISOString()
    };
    store.properties.unshift(newProp);
    res.status(201).json(newProp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE property
router.put('/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json(updated);
    }
    const idx = store.properties.findIndex((p) => p._id === req.params.id);
    if (idx !== -1) {
      store.properties[idx] = { ...store.properties[idx], ...req.body };
      return res.json(store.properties[idx]);
    }
    res.status(404).json({ error: 'Property not found' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE property
router.delete('/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      await Property.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Property deleted successfully' });
    }
    store.properties = store.properties.filter((p) => p._id !== req.params.id);
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
