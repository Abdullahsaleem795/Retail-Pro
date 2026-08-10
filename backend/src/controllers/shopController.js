const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const {
  GRANTABLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
} = require('../config/permissions');
const { getProvider } = require('../services/paymentProviders');
const { buildWhatsAppUrl } = require('../services/whatsappService');
const { sendUpgradePurchaseNotification } = require('../services/emailService');
const activationToken = require('../utils/activationToken');

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

  // Lazily flip an expired subscription rather than running a background job
  // for it - this endpoint is hit on every dashboard load, so status is never
  // stale for more than one page view.
  let shop = rows[0];
  if (shop.subscription_status === 'active' && shop.subscription_ends_at && new Date(shop.subscription_ends_at) < new Date()) {
    const { rows: updated } = await query(
      `UPDATE shops SET subscription_status = 'expired' WHERE id = $1 RETURNING *`,
      [req.shopId]
    );
    shop = updated[0];
  }

  res.json({ success: true, data: mapRow(shop) });
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

  // Resolves to a real gateway if one is ever configured (see
  // services/paymentProviders); today this always falls back to the manual
  // provider, which is exactly the existing record-and-WhatsApp-ping flow.
  const provider = getProvider(paymentChannel);
  await provider.createPaymentRequest({ transactionId, notes, planRequested, shopId: req.shopId });

  const trxRef = `${paymentChannel || 'Transfer'} TRX: ${transactionId || 'Pending'} (${planRequested || 'Pro'})`;
  await query(
    `UPDATE shops SET last_payment_trx = $1, subscription_status = 'pending_activation' WHERE id = $2`,
    [trxRef, req.shopId]
  );

  const { rows: shopRows } = await query('SELECT * FROM shops WHERE id = $1', [req.shopId]);
  const shop = mapRow(shopRows[0]);

  // Shown in the owner's own notification bell right after they submit - sets
  // the expectation that this is a two-step flow (submitted now, activated
  // once the admin verifies) rather than looking like nothing happened.
  const planLabel = (planRequested || 'Pro').charAt(0).toUpperCase() + (planRequested || 'Pro').slice(1);
  const message = `We've received your ${planLabel} plan request (${paymentChannel || 'Transfer'}, TRX: ${transactionId || 'N/A'}). You'll get a confirmation notification here as soon as it's verified and activated.`;
  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Upgrade Request Received', $2, 'in_app', 'sent')`,
    [req.shopId, message]
  );

  // Signed link that lets the admin activate this exact request in one click
  // from the email/WhatsApp notification, instead of opening the console,
  // finding the shop, and retyping the plan + duration by hand. The token is
  // verified server-side before anything is written - see
  // adminController.confirmActivationToken and utils/activationToken.js for
  // why this doesn't reopen the self-activation hole that was patched before.
  const normalizedPlan = ['basic', 'pro', 'enterprise'].includes(planRequested) ? planRequested : 'pro';
  const token = activationToken.sign({
    shopId: req.shopId,
    shopName: shop.name, // display-only on the confirm page; activation itself is keyed off shopId
    plan: normalizedPlan,
    durationMonths: 1,
    paymentChannel: paymentChannel || 'Transfer',
    transactionId: transactionId || 'N/A',
  });
  // CLIENT_URL can be a comma-separated list (see app.js CORS handling) -
  // the first entry is always the primary frontend origin the link should
  // point at.
  const frontendOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const confirmUrl = `${frontendOrigin}/admin/confirm/${token}`;

  const whatsappMsg = `Assalam-o-Alaikum,\n\nShop *${shop.name}* (ID: ${shop._id}) requested subscription upgrade:\n• Plan: *${planRequested || 'Pro'}*\n• Payment Mode: *${paymentChannel || 'JazzCash/EasyPaisa'}*\n• TRX ID: *${transactionId || 'N/A'}*\n\nPlease verify the payment, then tap to activate instantly:\n${confirmUrl}`;
  // Routed through the shared helper (not a second hand-rolled cleanPhone
  // regex) so ADMIN_WHATSAPP typed in the natural local format
  // ("03056779779", not "923056779779") still produces a working wa.me link.
  const whatsappUrl = buildWhatsAppUrl(process.env.ADMIN_WHATSAPP || '923056779779', whatsappMsg);

  // Best-effort - the admin's notify email is a self-service setting (see
  // /api/admin/payment-accounts), so it may be unset. Never let a missing or
  // broken SMTP config fail the shop's own upgrade request.
  const { rows: paymentAccountRows } = await query('SELECT notify_email FROM platform_payment_accounts WHERE id = 1');
  const notifyEmail = paymentAccountRows[0]?.notify_email;
  await sendUpgradePurchaseNotification({
    to: notifyEmail,
    shopName: shop.name,
    ownerName: shop.ownerName,
    plan: planRequested,
    paymentChannel,
    transactionId,
    confirmUrl,
  });

  res.json({
    success: true,
    message: 'Subscription upgrade request recorded. Please send payment proof via WhatsApp.',
    whatsappUrl,
    data: shop,
  });
});

// GET /api/shop/payment-accounts - read-only for any signed-in shop user.
// These are the platform operator's own receiving accounts (same for every
// shop), shown on the upgrade-request screen. Editing happens only through
// /api/admin/payment-accounts (see adminController.js) - a shop owner can
// read but never write these.
const getPaymentAccounts = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM platform_payment_accounts WHERE id = 1');

  // `banks` is the list the owner actually chooses from on the upgrade screen.
  // The legacy single bank_* fields are still returned above for now, but the
  // UI reads this array - that's what makes "pick which bank to pay into"
  // possible at all.
  const { rows: bankRows } = await query(
    'SELECT id, bank_name, account_title, iban, account_number FROM platform_bank_accounts ORDER BY sort_order, created_at'
  );

  const data = rows.length ? mapRow(rows[0]) : {};
  res.json({ success: true, data: { ...data, banks: mapRows(bankRows) } });
});

// NOTE: subscription activation is intentionally NOT exposed here. It used to
// be a shop-owner-callable endpoint gated only by shop:settings permission,
// which meant any shop owner could activate their own paid plan without ever
// paying - see docs/knowledge-graph.md gap #2. Activation now lives in
// adminController.js, gated by requirePlatformAdmin (a secret only the
// platform operator holds), reachable only via /api/admin/*.

module.exports = {
  getShop,
  updateShop,
  getUsers,
  getPaymentAccounts,
  createUser,
  updateUser,
  deleteUser,
  getGrantablePermissions,
  requestSubscriptionUpgrade,
};
