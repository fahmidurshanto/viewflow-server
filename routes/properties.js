const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const { optionalAuth, protect } = require('../middleware/auth');
const { checkPropertyLimit } = require('../middleware/planAccess');

// GET all properties
router.get('/', optionalAuth, async (req, res) => {
  try {
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
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single property
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const property = await Property.findById(req.params.id).populate('user', 'name email phone agencyName');
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE property (Protected with Plan Limit Check)
router.post('/', protect, checkPropertyLimit, async (req, res) => {
  try {
    const propData = {
      ...req.body,
      user: req.user._id
    };
    const property = new Property(propData);
    const saved = await property.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE property (Protected - ownership verified)
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const updated = await Property.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Property not found or access denied' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE property (Protected - ownership verified)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const deleted = await Property.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ error: 'Property not found or access denied' });
    }
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
