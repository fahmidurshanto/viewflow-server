const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Property = require('./models/Property');
const Lead = require('./models/Lead');
const Viewing = require('./models/Viewing');
const Task = require('./models/Task');
const ActivityLog = require('./models/ActivityLog');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viewflow');
    console.log('🌱 Connected to MongoDB for seeding...');

    // Clear existing
    await Property.deleteMany({});
    await Lead.deleteMany({});
    await Viewing.deleteMany({});
    await Task.deleteMany({});
    await ActivityLog.deleteMany({});

    // 1. Seed Properties
    const properties = await Property.insertMany([
      {
        title: 'Modern Waterfront Luxury Villa',
        description: 'Breathtaking 4-bedroom villa with panoramic bay views, private pool, and smart home automation.',
        price: 850000,
        type: 'Sale',
        propertyType: 'Villa',
        status: 'Available',
        address: {
          street: '124 Marina Boulevard',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101'
        },
        specs: { bedrooms: 4, bathrooms: 3, areaSqFt: 3400 },
        images: [
          'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80'
        ],
        featured: true
      },
      {
        title: 'Penthouse Apartment in Financial District',
        description: 'Exquisite 2-bed penthouse with 12ft floor-to-ceiling windows and direct skyline views.',
        price: 3600,
        type: 'Rent',
        propertyType: 'Apartment',
        status: 'Under Offer',
        address: {
          street: '45 Wall Street, Apt 38A',
          city: 'New York',
          state: 'NY',
          zipCode: '10005'
        },
        specs: { bedrooms: 2, bathrooms: 2, areaSqFt: 1550 },
        images: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
        ],
        featured: true
      },
      {
        title: 'Charming Suburban Family Home',
        description: 'Quiet neighborhood home featuring a spacious backyard, modern kitchen, and garage for 2 cars.',
        price: 495000,
        type: 'Sale',
        propertyType: 'House',
        status: 'Available',
        address: {
          street: '782 Maple Ridge Lane',
          city: 'Austin',
          state: 'TX',
          zipCode: '78704'
        },
        specs: { bedrooms: 3, bathrooms: 2, areaSqFt: 2200 },
        images: [
          'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
        ],
        featured: false
      },
      {
        title: 'Downtown Tech Loft & Studio',
        description: 'Industrial chic loft with brick accent walls, high ceilings, and walk-to-work location.',
        price: 2400,
        type: 'Rent',
        propertyType: 'Studio',
        status: 'Sold/Let',
        address: {
          street: '210 King Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94107'
        },
        specs: { bedrooms: 1, bathrooms: 1, areaSqFt: 980 },
        images: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
        ],
        featured: false
      }
    ]);

    console.log(`✅ Seeded ${properties.length} properties`);

    // 2. Seed Leads
    const leads = await Lead.insertMany([
      {
        name: 'Sarah Jenkins',
        email: 'sarah.j@example.com',
        phone: '+1 (555) 234-5678',
        stage: 'Viewing',
        budget: 900000,
        preferredLocation: 'Miami, FL',
        interestedProperty: properties[0]._id,
        notes: 'Pre-approved mortgage. Wants close to international schools.',
        source: 'Website'
      },
      {
        name: 'Michael Chang',
        email: 'm.chang@example.com',
        phone: '+1 (555) 876-5432',
        stage: 'Offer',
        budget: 3800,
        preferredLocation: 'New York, NY',
        interestedProperty: properties[1]._id,
        notes: 'Submitted offer of $3,500/month for 18-month lease.',
        source: 'Portal'
      },
      {
        name: 'David & Emma Vance',
        email: 'vance.family@example.com',
        phone: '+1 (555) 345-6789',
        stage: 'Contacted',
        budget: 520000,
        preferredLocation: 'Austin, TX',
        interestedProperty: properties[2]._id,
        notes: 'Requested virtual tour video and neighborhood crime stats.',
        source: 'Referral'
      },
      {
        name: 'Robert Sterling',
        email: 'robert@sterlingholdings.com',
        phone: '+1 (555) 901-2345',
        stage: 'Enquiry',
        budget: 1200000,
        preferredLocation: 'Miami Bay',
        interestedProperty: properties[0]._id,
        notes: 'Investor looking for high rental yield property.',
        source: 'Walk-in'
      }
    ]);

    console.log(`✅ Seeded ${leads.length} leads`);

    // 3. Seed Viewings
    const today = new Date();
    const tomorrow10am = new Date(today);
    tomorrow10am.setDate(tomorrow10am.getDate() + 1);
    tomorrow10am.setHours(10, 0, 0, 0);

    const dayAfter2pm = new Date(today);
    dayAfter2pm.setDate(dayAfter2pm.getDate() + 2);
    dayAfter2pm.setHours(14, 0, 0, 0);

    await Viewing.insertMany([
      {
        property: properties[0]._id,
        lead: leads[0]._id,
        scheduledDate: tomorrow10am,
        durationMinutes: 45,
        status: 'Scheduled'
      },
      {
        property: properties[2]._id,
        lead: leads[2]._id,
        scheduledDate: dayAfter2pm,
        durationMinutes: 45,
        status: 'Scheduled'
      }
    ]);

    // 4. Seed Tasks
    await Task.insertMany([
      {
        title: 'Send HOA documents to Sarah Jenkins',
        dueDate: tomorrow10am,
        priority: 'High',
        status: 'Pending',
        relatedLead: leads[0]._id,
        relatedProperty: properties[0]._id
      },
      {
        title: 'Review Counter-offer with Landlord for Apt 38A',
        dueDate: today,
        priority: 'High',
        status: 'In Progress',
        relatedLead: leads[1]._id,
        relatedProperty: properties[1]._id
      },
      {
        title: 'Confirm Austin Viewing with David & Emma',
        dueDate: dayAfter2pm,
        priority: 'Medium',
        status: 'Pending',
        relatedLead: leads[2]._id,
        relatedProperty: properties[2]._id
      }
    ]);

    // 5. Seed Activity Logs
    await ActivityLog.insertMany([
      {
        lead: leads[0]._id,
        type: 'Call',
        note: 'Initial phone call to qualify budget ($900k) and timeline. Confirmed Viewing for tomorrow 10:00 AM.',
        author: 'Lead Agent'
      },
      {
        lead: leads[1]._id,
        type: 'Stage Changed',
        note: 'Moved to "Offer" stage after receiving written intent to lease.',
        author: 'Lead Agent'
      }
    ]);

    console.log('🎉 Sample demo data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedData();
