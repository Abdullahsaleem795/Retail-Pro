const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    name: { type: String, required: true, trim: true },
    nameUrdu: { type: String, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    unit: {
      type: String,
      enum: ['pcs', 'kg', 'g', 'litre', 'ml', 'dozen', 'box', 'packet'],
      default: 'pcs',
    },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    expiryDate: { type: Date },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ shopId: 1, sku: 1 }, { unique: true });
productSchema.index({ shopId: 1, barcode: 1 });
productSchema.index({ shopId: 1, name: 1 });
productSchema.index({ shopId: 1, createdAt: -1 });
productSchema.index({ shopId: 1, stockQuantity: 1 });

module.exports = mongoose.model('Product', productSchema);
