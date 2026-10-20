const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    type: {
      type: String,
      enum: ['Sale', 'Rent'],
      default: 'Sale'
    },
    propertyType: {
      type: String,
      enum: ['Apartment', 'House', 'Villa', 'Commercial', 'Studio'],
      default: 'Apartment'
    },
    status: {
      type: String,
      enum: ['Available', 'Under Offer', 'Sold/Let'],
      default: 'Available'
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' }
    },
    specs: {
      bedrooms: { type: Number, default: 1 },
      bathrooms: { type: Number, default: 1 },
      areaSqFt: { type: Number, default: 0 }
    },
    images: [{ type: String }],
    featured: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Property', PropertySchema);
