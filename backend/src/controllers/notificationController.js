const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const {
  sendTextMessage,
  buildLowStockMessage,
  buildSupplierOrderDraft,
  buildWhatsAppUrl,
} = require('../services/whatsappService');

const getNotifications = asyncHandler(async (req, res) => {
  const [listResult, unreadResult] = await Promise.all([
    query('SELECT * FROM notifications WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50', [req.shopId]),
    query('SELECT COUNT(*) FROM notifications WHERE shop_id = $1 AND is_read = false', [req.shopId]),
  ]);
  const notifications = mapRows(listResult.rows);
  res.json({
    success: true,
    unreadCount: Number(unreadResult.rows[0].count),
    count: notifications.length,
    data: notifications,
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND shop_id = $2 RETURNING *`,
    [req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Notification not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE shop_id = $1 AND is_read = false', [req.shopId]);
  res.json({ success: true, message: 'All notifications marked as read' });
});

// POST /api/notifications/send-low-stock
// On-demand trigger so the shopkeeper can push the alert to their own WhatsApp
// without waiting for the nightly cron.
const sendLowStockAlert = asyncHandler(async (req, res) => {
  const [shopResult, lowStockResult] = await Promise.all([
    query('SELECT * FROM shops WHERE id = $1', [req.shopId]),
    query(
      `SELECT name, stock_quantity, unit FROM products
       WHERE shop_id = $1 AND is_active = true AND stock_quantity <= low_stock_threshold`,
      [req.shopId]
    ),
  ]);
  const shop = mapRow(shopResult.rows[0]);
  const lowStockProducts = mapRows(lowStockResult.rows);

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

  const { rows } = await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1,'low_stock',$2,$3,'whatsapp',$4) RETURNING *`,
    [req.shopId, `${lowStockProducts.length} items low on stock`, message, deliveryStatus]
  );

  const whatsappUrl = buildWhatsAppUrl(target, message);

  res.status(201).json({ success: true, deliveryStatus, whatsappUrl, data: mapRow(rows[0]) });
});

// POST /api/notifications/supplier-order/:supplierId
// Generates a ready-to-send restock message for a supplier, prefilled with the
// low-stock items that supplier normally provides.
const sendSupplierOrderDraft = asyncHandler(async (req, res) => {
  const [shopResult, supplierResult] = await Promise.all([
    query('SELECT * FROM shops WHERE id = $1', [req.shopId]),
    query('SELECT * FROM suppliers WHERE id = $1 AND shop_id = $2', [req.params.supplierId, req.shopId]),
  ]);
  const shop = mapRow(shopResult.rows[0]);
  const supplier = mapRow(supplierResult.rows[0]);
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  const { rows } = await query(
    `SELECT name, stock_quantity, low_stock_threshold, unit FROM products
     WHERE shop_id = $1 AND supplier_id = $2 AND is_active = true AND stock_quantity <= low_stock_threshold`,
    [req.shopId, supplier._id]
  );
  const items = mapRows(rows);

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
  const whatsappUrl = buildWhatsAppUrl(supplier.phone, message);

  let deliveryStatus = 'sent';
  try {
    const result = await sendTextMessage(supplier.phone, message);
    if (result?.skipped) deliveryStatus = 'skipped';
  } catch (err) {
    deliveryStatus = 'failed';
    console.error(`[whatsapp] supplier order failed for shop ${req.shopId}: ${err.message}`);
  }

  res.json({ success: true, deliveryStatus, message, whatsappUrl, items: orderItems });
});

module.exports = { getNotifications, markAsRead, markAllAsRead, sendLowStockAlert, sendSupplierOrderDraft };
