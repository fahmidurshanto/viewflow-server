const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Viewing = require('../models/Viewing');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const store = require('../config/mockStore');
const { protect } = require('../middleware/auth');

const isDbConnected = () => mongoose.connection.readyState === 1;

router.get('/', protect, async (req, res) => {
  try {
    if (isDbConnected()) {
      const userFilter = { user: req.user._id };

      const totalProperties = await Property.countDocuments(userFilter);
      const availableProperties = await Property.countDocuments({ ...userFilter, status: 'Available' });
      const soldProperties = await Property.countDocuments({ ...userFilter, status: 'Sold/Let' });

      const totalLeads = await Lead.countDocuments(userFilter);
      const leadsByStage = {
        Enquiry: await Lead.countDocuments({ ...userFilter, stage: 'Enquiry' }),
        Contacted: await Lead.countDocuments({ ...userFilter, stage: 'Contacted' }),
        Viewing: await Lead.countDocuments({ ...userFilter, stage: 'Viewing' }),
        Offer: await Lead.countDocuments({ ...userFilter, stage: 'Offer' }),
        Closed: await Lead.countDocuments({ ...userFilter, stage: 'Closed' })
      };

      const totalViewings = await Viewing.countDocuments(userFilter);
      const completedViewings = await Viewing.countDocuments({ ...userFilter, status: 'Completed' });

      const convertedLeads = (leadsByStage.Offer || 0) + (leadsByStage.Closed || 0);
      const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      const upcomingViewings = await Viewing.find({
        ...userFilter,
        scheduledDate: { $gte: new Date() },
        status: 'Scheduled'
      })
        .populate('property', 'title address price')
        .populate('lead', 'name phone email')
        .sort({ scheduledDate: 1 })
        .limit(5);

      const pendingTasks = await Task.find({ ...userFilter, status: { $ne: 'Completed' } })
        .sort({ dueDate: 1 })
        .limit(5);

      return res.json({
        metrics: {
          totalProperties,
          availableProperties,
          soldProperties,
          totalLeads,
          totalViewings,
          completedViewings,
          conversionRate
        },
        leadsByStage,
        upcomingViewings,
        pendingTasks
      });
    }

    // Fallback analytics
    const totalProperties = store.properties.length;
    const availableProperties = store.properties.filter((p) => p.status === 'Available').length;
    const soldProperties = store.properties.filter((p) => p.status === 'Sold/Let').length;

    const totalLeads = store.leads.length;
    const leadsByStage = {
      Enquiry: store.leads.filter((l) => l.stage === 'Enquiry').length,
      Contacted: store.leads.filter((l) => l.stage === 'Contacted').length,
      Viewing: store.leads.filter((l) => l.stage === 'Viewing').length,
      Offer: store.leads.filter((l) => l.stage === 'Offer').length,
      Closed: store.leads.filter((l) => l.stage === 'Closed').length
    };

    const totalViewings = store.viewings.length;
    const completedViewings = store.viewings.filter((v) => v.status === 'Completed').length;
    const conversionRate = totalLeads > 0 ? Math.round(((leadsByStage.Offer + leadsByStage.Closed) / totalLeads) * 100) : 0;

    const upcomingViewings = store.viewings.filter((v) => v.status === 'Scheduled').slice(0, 5);
    const pendingTasks = store.tasks.filter((t) => t.status !== 'Completed').slice(0, 5);

    res.json({
      metrics: {
        totalProperties,
        availableProperties,
        soldProperties,
        totalLeads,
        totalViewings,
        completedViewings,
        conversionRate
      },
      leadsByStage,
      upcomingViewings,
      pendingTasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESET DEMO DATA
router.post('/reset-demo', protect, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Demo reset is strictly disabled in production.' });
    }

    const userId = req.user._id;

    if (isDbConnected()) {
      // Clear ONLY current user's data
      const filter = { user: userId };
      await Property.deleteMany(filter);
      await Lead.deleteMany(filter);
      await Viewing.deleteMany(filter);
      await Task.deleteMany(filter);
      await ActivityLog.deleteMany(filter);

      // Seed Properties for this user
      const createdProperties = await Property.insertMany([
        {
          user: userId,
          title: 'Modern Waterfront Luxury Villa',
          description: 'Breathtaking 4-bedroom villa with panoramic bay views, private pool, and smart home automation.',
          price: 850000,
          type: 'Sale',
          propertyType: 'Villa',
          status: 'Available',
          address: { street: '124 Marina Boulevard', city: 'Miami', state: 'FL', zipCode: '33101' },
          specs: { bedrooms: 4, bathrooms: 3, areaSqFt: 3400 },
          images: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80'],
          featured: true
        },
        {
          user: userId,
          title: 'Penthouse Apartment in Financial District',
          description: 'Exquisite 2-bed penthouse with 12ft floor-to-ceiling windows and direct skyline views.',
          price: 3600,
          type: 'Rent',
          propertyType: 'Apartment',
          status: 'Under Offer',
          address: { street: '45 Wall Street, Apt 38A', city: 'New York', state: 'NY', zipCode: '10005' },
          specs: { bedrooms: 2, bathrooms: 2, areaSqFt: 1550 },
          images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
          featured: true
        },
        {
          user: userId,
          title: 'Charming Suburban Family Home',
          description: 'Quiet neighborhood home featuring a spacious backyard, modern kitchen, and garage for 2 cars.',
          price: 495000,
          type: 'Sale',
          propertyType: 'House',
          status: 'Available',
          address: { street: '782 Maple Ridge Lane', city: 'Austin', state: 'TX', zipCode: '78704' },
          specs: { bedrooms: 3, bathrooms: 2, areaSqFt: 2200 },
          images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'],
          featured: false
        }
      ]);

      // Seed Leads for this user
      const createdLeads = await Lead.insertMany([
        {
          user: userId,
          name: 'Sarah Jenkins',
          email: 'sarah.j@example.com',
          phone: '+1 (555) 234-5678',
          stage: 'Viewing',
          budget: 900000,
          preferredLocation: 'Miami, FL',
          interestedProperty: createdProperties[0]._id,
          notes: 'Pre-approved mortgage. Wants close to international schools.'
        },
        {
          user: userId,
          name: 'Marcus Brody',
          email: 'm.brody@venturecap.com',
          phone: '+1 (555) 876-5432',
          stage: 'Offer',
          budget: 3800,
          preferredLocation: 'New York, NY',
          interestedProperty: createdProperties[1]._id,
          notes: 'Needs immediate move-in by 1st of next month.'
        },
        {
          user: userId,
          name: 'David & Emma Vance',
          email: 'vance.family@example.com',
          phone: '+1 (555) 345-6789',
          stage: 'Enquiry',
          budget: 520000,
          preferredLocation: 'Austin, TX',
          interestedProperty: createdProperties[2]._id,
          notes: 'Requested virtual tour video and neighborhood crime stats.'
        }
      ]);

      // Seed Viewings
      await Viewing.create({
        user: userId,
        property: createdProperties[0]._id,
        lead: createdLeads[0]._id,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMinutes: 45,
        status: 'Scheduled'
      });

      // Seed Tasks
      await Task.insertMany([
        {
          user: userId,
          title: 'Send floor plan & HOA docs to Sarah Jenkins',
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          priority: 'High',
          status: 'Pending',
          relatedLead: createdLeads[0]._id,
          relatedProperty: createdProperties[0]._id
        },
        {
          user: userId,
          title: 'Prepare counter-offer agreement for Marcus',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority: 'Medium',
          status: 'Pending',
          relatedLead: createdLeads[1]._id,
          relatedProperty: createdProperties[1]._id
        }
      ]);

      return res.json({ success: true, message: 'Demo data has been refreshed for your account.' });
    }

    res.json({ success: true, message: 'Demo reset (in-memory mode).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
