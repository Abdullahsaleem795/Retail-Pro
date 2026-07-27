const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    creditBalance: { type: Number, default: 0 }, // positive = customer owes shop (khata/udhaar)
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ shopId: 1, name: 1 });
customerSchema.index({ shopId: 1, phone: 1 });
customerSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
