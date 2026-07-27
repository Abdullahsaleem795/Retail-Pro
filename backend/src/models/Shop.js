const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    businessType: {
      type: String,
      enum: ['kiryana', 'general', 'medical', 'wholesale', 'other'],
      default: 'general',
    },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    logoUrl: { type: String },
    currency: { type: String, default: 'PKR' },
    language: { type: String, enum: ['en', 'ur'], default: 'en' },
    whatsappNumber: { type: String, trim: true },
    lowStockThreshold: { type: Number, default: 10 },
    subscriptionPlan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);
