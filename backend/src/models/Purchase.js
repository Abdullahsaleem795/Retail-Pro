const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: { type: [purchaseItemSchema], validate: (v) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['pending', 'received', 'cancelled'], default: 'pending' },
    invoiceNumber: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

purchaseSchema.index({ shopId: 1, createdAt: -1 });
purchaseSchema.index({ shopId: 1, supplierId: 1 });
purchaseSchema.index({ shopId: 1, status: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
