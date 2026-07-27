const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Supplier = require('../models/Supplier');
const {
  sendTextMessage,
  buildLowStockMessage,
  buildSupplierOrderDraft,
} = require('../services/whatsappService');

const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ shopId: req.shopId }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ shopId: req.shopId, isRead: false });
  res.json({ success: true, unreadCount, count: notifications.length, data: notifications });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, shopId: req.shopId },
    { isRead: true },
    { new: true }
  );
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  res.json({ success: true, data: notification });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ shopId: req.shopId, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

// POST /api/notifications/send-low-stock
// On-demand trigger so the shopkeeper can push the alert to their own WhatsApp
// without waiting for the nightly cron.
const sendLowStockAlert = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.shopId);
  const lowStockProducts = await Product.find({
    shopId: req.shopId,
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
  }).select('name stockQuantity unit');

  if (lowStockProducts.length === 0) {
    res.status(400);
    throw new Error('No low stock items to report');
  }

  const message = buildLowStockMessage(shop.name, lowStockProducts);
  const target = shop.whatsappNumber || shop.phone;

  let deliveryStatus = 'sent';
  try {
    const result = await sendTextMessage(target, message);
    if (result?.skipped) deliveryStatus = 'skipped';
  } catch (err) {
    deliveryStatus = 'failed';
    console.error(`[whatsapp] low stock alert failed for shop ${req.shopId}: ${err.message}`);
  }

  const notification = await Notification.create({
    shopId: req.shopId,
    type: 'low_stock',
    title: `${lowStockProducts.length} items low on stock`,
    message,
    channel: 'whatsapp',
    deliveryStatus,
  });

  res.status(201).json({ success: true, deliveryStatus, data: notification });
});

// POST /api/notifications/supplier-order/:supplierId
// Generates a ready-to-send restock message for a supplier, prefilled with the
// low-stock items that supplier normally provides.
const sendSupplierOrderDraft = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.shopId);
  const supplier = await Supplier.findOne({ _id: req.params.supplierId, shopId: req.shopId });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  const items = await Product.find({
    shopId: req.shopId,
    supplierId: supplier._id,
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
  }).select('name stockQuantity lowStockThreshold unit');

  if (items.length === 0) {
    res.status(400);
    throw new Error('No low stock items for this supplier');
  }

  // Suggest restocking to double the threshold - a simple reorder heuristic that
  // covers the next cycle without over-ordering perishables.
  const orderItems = items.map((p) => ({
    name: p.name,
    unit: p.unit,
    quantity: Math.max(p.lowStockThreshold * 2 - p.stockQuantity, 1),
  }));

  const message = buildSupplierOrderDraft(shop.name, supplier.name, orderItems);

  let deliveryStatus = 'sent';
  try {
    const result = await sendTextMessage(supplier.phone, message);
    if (result?.skipped) deliveryStatus = 'skipped';
  } catch (err) {
    deliveryStatus = 'failed';
    console.error(`[whatsapp] supplier order failed for shop ${req.shopId}: ${err.message}`);
  }

  res.json({ success: true, deliveryStatus, message, items: orderItems });
});

module.exports = { getNotifications, markAsRead, markAllAsRead, sendLowStockAlert, sendSupplierOrderDraft };
