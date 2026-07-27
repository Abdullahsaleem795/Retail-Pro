const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true }, // snapshot at time of sale
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // selling price at time of sale
    costPrice: { type: Number, required: true, min: 0 }, // cost price at time of sale, for margin reports
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [saleItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'credit', 'jazzcash', 'easypaisa'], default: 'cash' },
    amountPaid: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['completed', 'refunded', 'voided'], default: 'completed' },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNumber: { type: String, required: true, trim: true },
    // Client-generated idempotency key. Offline sales are queued on the device
    // and retried on reconnect; without this a flaky network that drops the
    // response (but not the request) would record the same sale twice and
    // decrement stock twice.
    clientRef: { type: String, trim: true },
    // True when the sale was rung up offline and synced later - lets the
    // shopkeeper see which receipts were backfilled.
    syncedFromOffline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

saleSchema.index({ shopId: 1, createdAt: -1 });
saleSchema.index({ shopId: 1, receiptNumber: 1 }, { unique: true });
saleSchema.index({ shopId: 1, customerId: 1 });
saleSchema.index({ shopId: 1, status: 1 });
// Partial (not sparse) is required here: in a COMPOUND index, sparse only skips
// a document when every indexed field is missing. shopId is always present, so
// a sparse index would still index clientRef as null for ordinary online sales
// and the second such sale would collide on the unique constraint. The partial
// filter indexes only documents that actually carry a clientRef.
saleSchema.index(
  { shopId: 1, clientRef: 1 },
  { unique: true, partialFilterExpression: { clientRef: { $type: 'string' } } }
);

module.exports = mongoose.model('Sale', saleSchema);
