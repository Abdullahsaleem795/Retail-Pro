// Platform-operator (SaaS owner) endpoints - cross-tenant by design. Every
// other controller in this app scopes queries by req.shopId; these
// intentionally don't, because the platform admin manages ALL shops, not one.
// Gated by requirePlatformAdmin, never by a per-shop permission.
const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const activationToken = require('../utils/activationToken');

const PLAN_DURATIONS_MONTHS = { basic: 1, pro: 1, enterprise: 1 };

// Shared by the manual Activate button (activateSubscription) and the
// one-click email/WhatsApp link (confirmActivationToken) - same database
// write and same in-app notification either way, so the two paths can never
// drift into activating a shop differently depending on which route was used.
const performActivation = async ({ shopId, plan, months, isComplimentary, trxNote }) => {
  const { rows } = await query(
    `UPDATE shops SET
       subscription_plan = $1,
       subscription_status = 'active',
       subscription_ends_at = NOW() + ($2 || ' months')::interval,
       last_payment_trx = CASE WHEN $4 THEN $5 ELSE last_payment_trx END
     WHERE id = $3
     RETURNING *`,
    [plan, months, shopId, Boolean(trxNote), trxNote]
  );

  if (rows.length === 0) return null;

  const shop = mapRow(rows[0]);
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const endsAt = new Date(shop.subscriptionEndsAt).toLocaleDateString('en-PK');
  // Distinct wording for a paid confirmation vs. a free grant the owner never
  // requested a review for - "confirmed" would be misleading on a comp grant.
  const notifMessage = isComplimentary
    ? `You've been given free access to the ${planLabel} plan, active until ${endsAt}.`
    : `Your payment has been confirmed! The ${planLabel} plan is now active until ${endsAt}.`;
  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Subscription Confirmed', $2, 'in_app', 'sent')`,
    [shopId, notifMessage]
  );

  return shop;
};

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

  const shop = await performActivation({ shopId, plan, months, isComplimentary, trxNote });
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }

  res.json({
    success: true,
    message: `Activated ${plan} for ${months} month(s)${isComplimentary ? ' (free grant)' : ''}`,
    data: shop,
  });
});

// POST /api/admin/subscription/confirm-token
// The one-click "Confirm & Activate" link sent to the admin's email/WhatsApp
// when a shop submits an upgrade request (see shopController.requestSubscriptionUpgrade).
// Still gated by requirePlatformAdmin like every other route here - the token
// only carries WHAT to activate, it is not itself a credential. Verifying the
// signature server-side (rather than trusting whatever the frontend decoded
// for display) means a tampered shopId/plan/duration can never slip through
// even though this endpoint is one click away from writing to the database.
const confirmActivationToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const payload = activationToken.verify(token);

  if (!payload) {
    res.status(400);
    throw new Error('This activation link is invalid or has expired. Ask the shop to resubmit their upgrade request.');
  }

  const { shopId, plan, durationMonths, paymentChannel, transactionId } = payload;
  const months = Number(durationMonths) > 0 ? Number(durationMonths) : PLAN_DURATIONS_MONTHS[plan] || 1;
  const trxNote = `${paymentChannel || 'Transfer'} TRX: ${transactionId || 'N/A'} (${plan}) - confirmed via one-click link`;

  const shop = await performActivation({ shopId, plan, months, isComplimentary: false, trxNote });
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found - it may have been deleted since this link was sent.');
  }

  res.json({
    success: true,
    message: `Activated ${plan} for ${shop.name} (${months} month${months === 1 ? '' : 's'})`,
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

// POST /api/admin/shops/:shopId/subscription/expire-trial
// Manual, operator-triggered - there's no automatic trial-length timer today
// (a new shop's subscription_ends_at is left NULL, see the schema default),
// so this is the actual enforcement mechanism: the admin decides when a
// shop's free access ends, not a clock. Deliberately gives no advance warning
// to the shop - the owner only finds out via the hard-lockout screen the next
// time anyone at that shop loads the dashboard (see DashboardLayout.jsx).
const expireTrial = asyncHandler(async (req, res) => {
  const { shopId } = req.params;

  const { rows } = await query(
    `UPDATE shops SET subscription_status = 'expired', subscription_ends_at = NOW() WHERE id = $1 RETURNING *`,
    [shopId]
  );

  if (rows.length === 0) {
    res.status(404);
    throw new Error('Shop not found');
  }

  const shop = mapRow(rows[0]);

  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1, 'subscription', 'Free Trial Ended', $2, 'in_app', 'sent')`,
    [shopId, 'Your free trial has ended. Kindly upgrade your plan to continue.']
  );

  res.json({ success: true, message: `${shop.name}'s trial marked as expired`, data: shop });
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

// --- Bank accounts -------------------------------------------------------
// A LIST, unlike the single bank fields still on platform_payment_accounts:
// a shop owner picks which of the operator's banks to transfer into, so the
// operator needs to advertise more than one. Read by every shop through
// GET /api/shop/payment-accounts; only writable here.

// GET /api/admin/bank-accounts
const listBankAccounts = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM platform_bank_accounts ORDER BY sort_order, created_at'
  );
  res.json({ success: true, count: rows.length, data: mapRows(rows) });
});

// Shared by create and update - a bank is only useful to pay into if the
// owner can identify it AND has a number to send money to, so those are the
// only hard requirements.
const readBankBody = (req, res) => {
  const bankName = (req.body.bankName || '').trim();
  const accountTitle = (req.body.accountTitle || '').trim();
  const iban = (req.body.iban || '').trim();
  const accountNumber = (req.body.accountNumber || '').trim();

  if (!bankName || !accountTitle) {
    res.status(400);
    throw new Error('bankName and accountTitle are required');
  }
  if (!iban && !accountNumber) {
    res.status(400);
    throw new Error('Provide an IBAN or an account number');
  }

  return { bankName, accountTitle, iban: iban || null, accountNumber: accountNumber || null };
};

// POST /api/admin/bank-accounts
const createBankAccount = asyncHandler(async (req, res) => {
  const { bankName, accountTitle, iban, accountNumber } = readBankBody(req, res);
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  const { rows } = await query(
    `INSERT INTO platform_bank_accounts (bank_name, account_title, iban, account_number, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [bankName, accountTitle, iban, accountNumber, sortOrder]
  );

  res.status(201).json({ success: true, message: `${bankName} added`, data: mapRow(rows[0]) });
});

// PUT /api/admin/bank-accounts/:id
const updateBankAccount = asyncHandler(async (req, res) => {
  const { bankName, accountTitle, iban, accountNumber } = readBankBody(req, res);
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  const { rows } = await query(
    `UPDATE platform_bank_accounts SET
       bank_name = $1, account_title = $2, iban = $3, account_number = $4,
       sort_order = $5, updated_at = now()
     WHERE id = $6
     RETURNING *`,
    [bankName, accountTitle, iban, accountNumber, sortOrder, req.params.id]
  );

  if (rows.length === 0) {
    res.status(404);
    throw new Error('Bank account not found');
  }

  res.json({ success: true, message: 'Bank account updated', data: mapRow(rows[0]) });
});

// DELETE /api/admin/bank-accounts/:id
const deleteBankAccount = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM platform_bank_accounts WHERE id = $1', [req.params.id]);
  if (rowCount === 0) {
    res.status(404);
    throw new Error('Bank account not found');
  }
  res.json({ success: true, message: 'Bank account removed' });
});

module.exports = {
  listShops,
  activateSubscription,
  confirmActivationToken,
  rejectSubscription,
  expireTrial,
  getPaymentAccounts,
  updatePaymentAccounts,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
};
