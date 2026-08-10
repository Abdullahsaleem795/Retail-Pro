// Platform-operator (SaaS owner) endpoints - cross-tenant by design. Every
// other controller in this app scopes queries by req.shopId; these
// intentionally don't, because the platform admin manages ALL shops, not one.
// Gated by requirePlatformAdmin, never by a per-shop permission.
const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const PLAN_DURATIONS_MONTHS = { basic: 1, pro: 1, enterprise: 1 };

// GET /api/admin/shops?status=pending_activation
const listShops = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE subscription_status = $1';
  }

  const { rows } = await query(
    `SELECT id, name, owner_name, phone, email, city, subscription_plan,
            subscription_status, subscription_ends_at, last_payment_trx, created_at
     FROM shops ${where}
     ORDER BY
       CASE subscription_status WHEN 'pending_activation' THEN 0 ELSE 1 END,
       created_at DESC`,
    params
  );

  res.json({ success: true, count: rows.length, data: mapRows(rows) });
});

// POST /api/admin/shops/:shopId/subscription/activate
// This is the ONLY place a shop's subscription can be set to 'active' - see
// platformAdmin.js for why this must not be reachable via a shop-owner token.
//
// Nothing here has ever required proof of payment - the operator could
// already activate any plan on any shop with no verification. `complimentary`
// doesn't change what's allowed, only whether it's RECORDED as a free grant:
// unchecked, last_payment_trx is left as whatever the shop's own upgrade
// request already put there (the real TRX reference); checked, it's
// overwritten with a clearly-labeled free-grant note so paid vs comped shops
// are distinguishable later instead of looking identical in the shop list.
const activateSubscription = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  const { plan, durationMonths, complimentary, note } = req.body;

  const validPlans = ['basic', 'pro', 'enterprise'];
  if (!validPlans.includes(plan)) {
    res.status(400);
    throw new Error(`plan must be one of ${validPlans.join(', ')}`);
  }

  const months = Number(durationMonths) > 0 ? Number(durationMonths) : PLAN_DURATIONS_MONTHS[plan] || 1;
  const isComplimentary = Boolean(complimentary);
  const trxNote = isComplimentary
    ? `Free grant (no payment)${note ? ` - ${note}` : ''}`
    : null;

  const { rows } = await query(
    `UPDATE shops SET
       subscription_plan = $1,
       subscription_status = 'active',
       subscription_ends_at = NOW() + ($2 || ' months')::interval,
       last_payment_trx = CASE WHEN $4 THEN $5 ELSE last_payment_trx END
     WHERE id = $3
     RETURNING *`,
    [plan, months, shopId, isComplimentary, trxNote]
  );

  if (rows.length === 0) {
    res.status(404);
    throw new Error('Shop not found');
  }

  const shop = mapRow(rows[0]);

  const activationNote = isComplimentary ? ' (complimentary access)' : '';
  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Subscription Activated', $2, 'in_app', 'sent')`,
    [shopId, `Your ${plan} plan is now active until ${new Date(shop.subscriptionEndsAt).toLocaleDateString('en-PK')}${activationNote}.`]
  );

  res.json({
    success: true,
    message: `Activated ${plan} for ${months} month(s)${isComplimentary ? ' (free grant)' : ''}`,
    data: shop,
  });
});

// POST /api/admin/shops/:shopId/subscription/reject
const rejectSubscription = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  const { reason } = req.body;

  const { rows } = await query(
    `UPDATE shops SET subscription_status = 'cancelled' WHERE id = $1 RETURNING *`,
    [shopId]
  );

  if (rows.length === 0) {
    res.status(404);
    throw new Error('Shop not found');
  }

  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Subscription Request Rejected', $2, 'in_app', 'sent')`,
    [shopId, reason ? `Upgrade request rejected: ${reason}` : 'Upgrade request rejected - payment not verified.']
  );

  res.json({ success: true, message: 'Subscription request rejected', data: mapRow(rows[0]) });
});

// GET /api/admin/payment-accounts
const getPaymentAccounts = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM platform_payment_accounts WHERE id = 1');
  res.json({ success: true, data: rows.length ? mapRow(rows[0]) : null });
});

// PUT /api/admin/payment-accounts
// Updates the singleton row of operator-owned receiving accounts shown to
// every shop on the upgrade screen (Settings.jsx -> GET /api/shop/payment-accounts).
// Blank fields are accepted as-is (an owner may only run JazzCash, not a bank
// account, for example) rather than rejected - this isn't a shop-facing form
// with required fields, it's the operator's own info.
const updatePaymentAccounts = asyncHandler(async (req, res) => {
  const {
    jazzcashTitle, jazzcashNumber,
    easypaisaTitle, easypaisaNumber,
    bankTitle, bankName, bankIban,
    notifyEmail,
  } = req.body;

  const { rows } = await query(
    `UPDATE platform_payment_accounts SET
       jazzcash_title = $1, jazzcash_number = $2,
       easypaisa_title = $3, easypaisa_number = $4,
       bank_title = $5, bank_name = $6, bank_iban = $7,
       notify_email = $8,
       updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [
      jazzcashTitle || null, jazzcashNumber || null,
      easypaisaTitle || null, easypaisaNumber || null,
      bankTitle || null, bankName || null, bankIban || null,
      notifyEmail || null,
    ]
  );

  res.json({ success: true, message: 'Payment accounts updated', data: mapRow(rows[0]) });
});

module.exports = {
  listShops,
  activateSubscription,
  rejectSubscription,
  getPaymentAccounts,
  updatePaymentAccounts,
};
