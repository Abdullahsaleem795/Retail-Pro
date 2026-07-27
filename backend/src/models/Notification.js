const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    type: {
      type: String,
      enum: ['low_stock', 'daily_report', 'weekly_report', 'expiry', 'payment_due', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    channel: { type: String, enum: ['in_app', 'whatsapp'], default: 'in_app' },
    deliveryStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
  },
  { timestamps: true }
);

notificationSchema.index({ shopId: 1, createdAt: -1 });
notificationSchema.index({ shopId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
