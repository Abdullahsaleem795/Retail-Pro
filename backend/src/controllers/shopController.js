const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const {
  GRANTABLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
} = require('../config/permissions');

const getGrantablePermissions = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      grantable: GRANTABLE_PERMISSIONS,
      roleDefaults: ROLE_PERMISSIONS,
    },
  });
});

// Only permissions on the grantable list are accepted, so a crafted request
// can't slip in staff:manage or shop:settings and escalate privileges.
const sanitizePermissions = (permissions) =>
  Array.isArray(permissions) ? permissions.filter((p) => GRANTABLE_PERMISSIONS.includes(p)) : undefined;

const getShop = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM shops WHERE id = $1', [req.shopId]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Shop not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const updateShop = asyncHandler(async (req, res) => {
  const {
    name, businessType, ownerName, phone, email, address, city,
    logoUrl, language, whatsappNumber, lowStockThreshold,
  } = req.body;

  const { rows } = await query(
    `UPDATE shops SET
       name = COALESCE($1, name), business_type = COALESCE($2, business_type),
       owner_name = COALESCE($3, owner_name), phone = COALESCE($4, phone),
       email = COALESCE($5, email), address = COALESCE($6, address), city = COALESCE($7, city),
       logo_url = COALESCE($8, logo_url), language = COALESCE($9, language),
       whatsapp_number = COALESCE($10, whatsapp_number),
       low_stock_threshold = COALESCE($11, low_stock_threshold)
     WHERE id = $12
     RETURNING *`,
    [name, businessType, ownerName, phone, email, address, city, logoUrl, language,
     whatsappNumber, lowStockThreshold, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Shop not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const getUsers = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, phone, role, is_active, last_login_at, permissions
     FROM users WHERE shop_id = $1 ORDER BY created_at ASC`,
    [req.shopId]
  );
  const users = mapRows(rows);
  res.json({
    success: true,
    count: users.length,
    data: users.map((u) => ({
      ...u,
      permissions: u.permissions || [],
      effectivePermissions: getEffectivePermissions(u),
    })),
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, permissions } = req.body;

  // A shop can only ever have one owner; staff are managers or cashiers.
  if (role === 'owner') {
    res.status(400);
    throw new Error('A shop can only have one owner');
  }

  const existing = await query('SELECT id FROM users WHERE shop_id = $1 AND email = $2', [req.shopId, email]);
  if (existing.rows.length > 0) {
    res.status(409);
    throw new Error('A user with this email already exists in this shop');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (shop_id, name, email, password, phone, role, permissions)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, name, email, role, permissions`,
    [req.shopId, name, email, passwordHash, phone, role || 'cashier', sanitizePermissions(permissions) || []]
  );

  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, role, isActive, permissions } = req.body;

  if (role === 'owner') {
    res.status(400);
    throw new Error('Cannot promote a user to owner');
  }

  const targetResult = await query('SELECT * FROM users WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (targetResult.rows.length === 0) {
    res.status(404);
    throw new Error('User not found');
  }
  if (targetResult.rows[0].role === 'owner') {
    res.status(403);
    throw new Error('The shop owner account cannot be modified here');
  }

  const cleanPermissions = sanitizePermissions(permissions);

  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($1, name), phone = COALESCE($2, phone), role = COALESCE($3, role),
       is_active = COALESCE($4, is_active), permissions = COALESCE($5, permissions)
     WHERE id = $6
     RETURNING id, name, role, is_active, permissions`,
    [name, phone, role, isActive, cleanPermissions, req.params.id]
  );

  const target = mapRow(rows[0]);
  res.json({
    success: true,
    data: { ...target, effectivePermissions: getEffectivePermissions(target) },
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const targetResult = await query('SELECT role FROM users WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (targetResult.rows.length === 0) {
    res.status(404);
    throw new Error('User not found');
  }
  if (targetResult.rows[0].role === 'owner') {
    res.status(403);
    throw new Error('The shop owner account cannot be deleted');
  }
  if (String(req.params.id) === String(req.userId)) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'User removed' });
});

// POST /api/shop/subscription/request-upgrade
const requestSubscriptionUpgrade = asyncHandler(async (req, res) => {
  const { planRequested, paymentChannel, transactionId, notes } = req.body;

  const trxRef = `${paymentChannel || 'Transfer'} TRX: ${transactionId || 'Pending'} (${planRequested || 'Pro'})`;
  await query(
    `UPDATE shops SET last_payment_trx = $1, subscription_status = 'pending_activation' WHERE id = $2`,
    [trxRef, req.shopId]
  );

  const { rows: shopRows } = await query('SELECT * FROM shops WHERE id = $1', [req.shopId]);
  const shop = mapRow(shopRows[0]);

  // Insert notification for audit trail
  const message = `Upgrade request submitted for ${planRequested || 'Pro Plan'} via ${paymentChannel || 'Transfer'}. TRX ID: ${transactionId || 'N/A'}`;
  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Subscription Upgrade Submitted', $2, 'in_app', 'sent')`,
    [req.shopId, message]
  );

  const whatsappMsg = `Assalam-o-Alaikum,\n\nShop *${shop.name}* (ID: ${shop._id}) requested subscription upgrade:\n• Plan: *${planRequested || 'Pro'}*\n• Payment Mode: *${paymentChannel || 'JazzCash/EasyPaisa'}*\n• TRX ID: *${transactionId || 'N/A'}*\n\nPlease verify and activate subscription.`;
  const cleanPhone = (process.env.ADMIN_WHATSAPP || '923056779779').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;

  res.json({
    success: true,
    message: 'Subscription upgrade request recorded. Please send payment proof via WhatsApp.',
    whatsappUrl,
    data: shop,
  });
});

// POST /api/shop/subscription/activate (For Admin/Owner to set plan and extend validity)
const activateSubscription = asyncHandler(async (req, res) => {
  const { plan, durationMonths = 1 } = req.body;

  const { rows } = await query(
    `UPDATE shops SET
       subscription_plan = $1,
       subscription_status = 'active',
       subscription_ends_at = NOW() + ($2 || '1 month')::interval
     WHERE id = $3
     RETURNING *`,
    [plan || 'pro', `${durationMonths} months`, req.shopId]
  );

  res.json({
    success: true,
    message: `Subscription updated to ${plan || 'pro'} plan for ${durationMonths} month(s)`,
    data: mapRow(rows[0]),
  });
});

module.exports = {
  getShop,
  updateShop,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getGrantablePermissions,
  requestSubscriptionUpgrade,
  activateSubscription,
};
