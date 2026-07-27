const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    balance: { type: Number, default: 0 }, // positive = shop owes supplier
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ shopId: 1, name: 1 });
supplierSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);
