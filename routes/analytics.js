const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Viewing = require('../models/Viewing');
const Task = require('../models/Task');
const store = require('../config/mockStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const totalProperties = await Property.countDocuments();
      const availableProperties = await Property.countDocuments({ status: 'Available' });
      const soldProperties = await Property.countDocuments({ status: 'Sold/Let' });

      const totalLeads = await Lead.countDocuments();
      const leadsByStage = {
        Enquiry: await Lead.countDocuments({ stage: 'Enquiry' }),
        Contacted: await Lead.countDocuments({ stage: 'Contacted' }),
        Viewing: await Lead.countDocuments({ stage: 'Viewing' }),
        Offer: await Lead.countDocuments({ stage: 'Offer' }),
        Closed: await Lead.countDocuments({ stage: 'Closed' })
      };

      const totalViewings = await Viewing.countDocuments();
      const completedViewings = await Viewing.countDocuments({ status: 'Completed' });

      const convertedLeads = (leadsByStage.Offer || 0) + (leadsByStage.Closed || 0);
      const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      const upcomingViewings = await Viewing.find({
        scheduledDate: { $gte: new Date() },
        status: 'Scheduled'
      })
        .populate('property', 'title address price')
        .populate('lead', 'name phone email')
        .sort({ scheduledDate: 1 })
        .limit(5);

      const pendingTasks = await Task.find({ status: { $ne: 'Completed' } })
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

module.exports = router;
