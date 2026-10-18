// In-Memory fallback store so the project runs immediately with zero setup
let properties = [
  {
    _id: 'prop-1',
    title: 'Modern Waterfront Luxury Villa',
    description: 'Breathtaking 4-bedroom villa with panoramic bay views, private pool, and smart home automation.',
    price: 850000,
    type: 'Sale',
    propertyType: 'Villa',
    status: 'Available',
    address: { street: '124 Marina Boulevard', city: 'Miami', state: 'FL', zipCode: '33101' },
    specs: { bedrooms: 4, bathrooms: 3, areaSqFt: 3400 },
    images: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80'],
    featured: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'prop-2',
    title: 'Penthouse Apartment in Financial District',
    description: 'Exquisite 2-bed penthouse with 12ft floor-to-ceiling windows and direct skyline views.',
    price: 3600,
    type: 'Rent',
    propertyType: 'Apartment',
    status: 'Under Offer',
    address: { street: '45 Wall Street, Apt 38A', city: 'New York', state: 'NY', zipCode: '10005' },
    specs: { bedrooms: 2, bathrooms: 2, areaSqFt: 1550 },
    images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
    featured: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'prop-3',
    title: 'Charming Suburban Family Home',
    description: 'Quiet neighborhood home featuring a spacious backyard, modern kitchen, and garage for 2 cars.',
    price: 495000,
    type: 'Sale',
    propertyType: 'House',
    status: 'Available',
    address: { street: '782 Maple Ridge Lane', city: 'Austin', state: 'TX', zipCode: '78704' },
    specs: { bedrooms: 3, bathrooms: 2, areaSqFt: 2200 },
    images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'],
    featured: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'prop-4',
    title: 'Downtown Tech Loft & Studio',
    description: 'Industrial chic loft with brick accent walls, high ceilings, and walk-to-work location.',
    price: 2400,
    type: 'Rent',
    propertyType: 'Studio',
    status: 'Sold/Let',
    address: { street: '210 King Street', city: 'San Francisco', state: 'CA', zipCode: '94107' },
    specs: { bedrooms: 1, bathrooms: 1, areaSqFt: 980 },
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'],
    featured: false,
    createdAt: new Date().toISOString()
  }
];

let leads = [
  {
    _id: 'lead-1',
    name: 'Sarah Jenkins',
    email: 'sarah.j@example.com',
    phone: '+1 (555) 234-5678',
    stage: 'Viewing',
    budget: 900000,
    preferredLocation: 'Miami, FL',
    interestedProperty: properties[0],
    notes: 'Pre-approved mortgage. Wants close to international schools.',
    source: 'Website',
    createdAt: new Date().toISOString()
  },
  {
    _id: 'lead-2',
    name: 'Michael Chang',
    email: 'm.chang@example.com',
    phone: '+1 (555) 876-5432',
    stage: 'Offer',
    budget: 3800,
    preferredLocation: 'New York, NY',
    interestedProperty: properties[1],
    notes: 'Submitted offer of $3,500/month for 18-month lease.',
    source: 'Portal',
    createdAt: new Date().toISOString()
  },
  {
    _id: 'lead-3',
    name: 'David & Emma Vance',
    email: 'vance.family@example.com',
    phone: '+1 (555) 345-6789',
    stage: 'Contacted',
    budget: 520000,
    preferredLocation: 'Austin, TX',
    interestedProperty: properties[2],
    notes: 'Requested virtual tour video and neighborhood crime stats.',
    source: 'Referral',
    createdAt: new Date().toISOString()
  },
  {
    _id: 'lead-4',
    name: 'Robert Sterling',
    email: 'robert@sterlingholdings.com',
    phone: '+1 (555) 901-2345',
    stage: 'Enquiry',
    budget: 1200000,
    preferredLocation: 'Miami Bay',
    interestedProperty: properties[0],
    notes: 'Investor looking for high rental yield property.',
    source: 'Walk-in',
    createdAt: new Date().toISOString()
  }
];

const tomorrow10am = new Date(Date.now() + 24 * 60 * 60 * 1000);
tomorrow10am.setHours(10, 0, 0, 0);

const dayAfter2pm = new Date(Date.now() + 48 * 60 * 60 * 1000);
dayAfter2pm.setHours(14, 0, 0, 0);

let viewings = [
  {
    _id: 'viewing-1',
    property: properties[0],
    lead: leads[0],
    scheduledDate: tomorrow10am.toISOString(),
    durationMinutes: 45,
    status: 'Scheduled',
    reminderSent: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'viewing-2',
    property: properties[2],
    lead: leads[2],
    scheduledDate: dayAfter2pm.toISOString(),
    durationMinutes: 45,
    status: 'Scheduled',
    reminderSent: false,
    createdAt: new Date().toISOString()
  }
];

let tasks = [
  {
    _id: 'task-1',
    title: 'Send HOA documents to Sarah Jenkins',
    dueDate: tomorrow10am.toISOString(),
    priority: 'High',
    status: 'Pending',
    relatedLead: leads[0],
    relatedProperty: properties[0]
  },
  {
    _id: 'task-2',
    title: 'Review Counter-offer with Landlord for Apt 38A',
    dueDate: new Date().toISOString(),
    priority: 'High',
    status: 'In Progress',
    relatedLead: leads[1],
    relatedProperty: properties[1]
  },
  {
    _id: 'task-3',
    title: 'Confirm Austin Viewing with David & Emma',
    dueDate: dayAfter2pm.toISOString(),
    priority: 'Medium',
    status: 'Pending',
    relatedLead: leads[2],
    relatedProperty: properties[2]
  }
];

let activities = [
  {
    _id: 'act-1',
    lead: 'lead-1',
    type: 'Call',
    note: 'Initial phone call to qualify budget ($900k) and timeline. Confirmed Viewing for tomorrow 10:00 AM.',
    author: 'Lead Agent',
    createdAt: new Date().toISOString()
  },
  {
    _id: 'act-2',
    lead: 'lead-2',
    type: 'Stage Changed',
    note: 'Moved to "Offer" stage after receiving written intent to lease.',
    author: 'Lead Agent',
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  properties,
  leads,
  viewings,
  tasks,
  activities
};
