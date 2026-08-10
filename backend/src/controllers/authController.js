const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { mapRow } = require('../utils/sqlMapper');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { getEffectivePermissions } = require('../config/permissions');

const tokenPayload = (user) => ({
  userId: user._id,
  shopId: user.shopId,
  role: user.role,
});

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

// @route POST /api/auth/register
// Creates a new Shop plus its first user (owner) atomically. This is the only
// place a shopId is ever generated - every subsequent request derives shopId
// from the JWT, never from client input.
const registerShopOwner = asyncHandler(async (req, res) => {
  const { shopName, businessType, ownerName, phone, email, password, city } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);

  const { shop, user } = await withTransaction(async (client) => {
    const shopResult = await client.query(
      `INSERT INTO shops (name, business_type, owner_name, phone, email, city)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [shopName, businessType || 'general', ownerName, phone, email, city]
    );
    const shopRow = mapRow(shopResult.rows[0]);

    const userResult = await client.query(
      `INSERT INTO users (shop_id, name, email, password, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'owner') RETURNING *`,
      [shopRow._id, ownerName, email, passwordHash, phone]
    );
    return { shop: shopRow, user: mapRow(userResult.rows[0]) };
  });

  const accessToken = generateAccessToken(tokenPayload(user));
  const refreshToken = generateRefreshToken(tokenPayload(user));

  res.status(201).json({
    success: true,
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    shop: {
      id: shop._id, name: shop.name, businessType: shop.businessType,
      subscriptionPlan: shop.subscriptionPlan, subscriptionStatus: shop.subscriptionStatus,
      subscriptionEndsAt: shop.subscriptionEndsAt,
    },
  });
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT u.*, s.id AS shop_pk, s.name AS shop_name, s.business_type AS shop_business_type,
            s.is_active AS shop_is_active, s.subscription_plan AS shop_subscription_plan,
            s.subscription_status AS shop_subscription_status, s.subscription_ends_at AS shop_subscription_ends_at
     FROM users u JOIN shops s ON s.id = u.shop_id
     WHERE u.email = $1`,
    [email]
  );

  if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const row = rows[0];
  if (!row.is_active || !row.shop_is_active) {
    res.status(403);
    throw new Error('Account or shop is deactivated');
  }

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);

  const user = mapRow(row);
  const accessToken = generateAccessToken(tokenPayload(user));
  const refreshToken = generateRefreshToken(tokenPayload(user));

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
      hasPin: Boolean(row.pin),
    },
    shop: {
      id: row.shop_pk, name: row.shop_name, businessType: row.shop_business_type,
      subscriptionPlan: row.shop_subscription_plan, subscriptionStatus: row.shop_subscription_status,
      subscriptionEndsAt: row.shop_subscription_ends_at,
    },
    permissions: getEffectivePermissions(user),
  });
});

// @route POST /api/auth/pin-login
// The quick-switch path for a shared shop PC: once someone has done one real
// email+password login on this browser, the frontend remembers {id, name,
// role} locally (no secrets) and offers a tile to tap instead of retyping
// credentials every shift handoff. Looking a user up by id (a UUID from that
// local list) rather than by email means this endpoint can never be used to
// enumerate accounts - you already have to know exactly who you're signing
// in as.
//
// PINs are short (4-6 digits), so unlike password login this needs its own
// per-account lockout on top of the IP-based authLimiter - on a shared PC,
// IP limiting alone doesn't stop one coworker brute-forcing another's PIN
// from the same counter.
const pinLogin = asyncHandler(async (req, res) => {
  const { userId, pin } = req.body;

  if (!userId || !pin) {
    res.status(400);
    throw new Error('userId and pin are required');
  }

  const { rows } = await query(
    `SELECT u.*, s.id AS shop_pk, s.name AS shop_name, s.business_type AS shop_business_type,
            s.is_active AS shop_is_active, s.subscription_plan AS shop_subscription_plan,
            s.subscription_status AS shop_subscription_status, s.subscription_ends_at AS shop_subscription_ends_at
     FROM users u JOIN shops s ON s.id = u.shop_id
     WHERE u.id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    res.status(401);
    throw new Error('Account not found - sign in with your password');
  }

  const row = rows[0];

  if (!row.pin) {
    res.status(400);
    throw new Error('No PIN set up for this account yet - sign in with your password');
  }

  if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(row.pin_locked_until) - new Date()) / 60000);
    res.status(429);
    throw new Error(`Too many incorrect PIN attempts. Try again in ${minutesLeft} minute(s), or sign in with your password.`);
  }

  const pinMatches = await bcrypt.compare(String(pin), row.pin);

  if (!pinMatches) {
    const attempts = row.pin_failed_attempts + 1;
    if (attempts >= PIN_MAX_ATTEMPTS) {
      await query(
        `UPDATE users SET pin_failed_attempts = 0, pin_locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1`,
        [row.id, PIN_LOCK_MINUTES]
      );
      res.status(429);
      throw new Error(`Too many incorrect PIN attempts. Try again in ${PIN_LOCK_MINUTES} minutes, or sign in with your password.`);
    }
    await query('UPDATE users SET pin_failed_attempts = $1 WHERE id = $2', [attempts, row.id]);
    res.status(401);
    throw new Error(`Incorrect PIN (${PIN_MAX_ATTEMPTS - attempts} attempt(s) left)`);
  }

  if (!row.is_active || !row.shop_is_active) {
    res.status(403);
    throw new Error('Account or shop is deactivated');
  }

  await query(
    'UPDATE users SET last_login_at = now(), pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1',
    [row.id]
  );

  const user = mapRow(row);
  const accessToken = generateAccessToken(tokenPayload(user));
  const refreshToken = generateRefreshToken(tokenPayload(user));

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
      hasPin: true,
    },
    shop: {
      id: row.shop_pk, name: row.shop_name, businessType: row.shop_business_type,
      subscriptionPlan: row.shop_subscription_plan, subscriptionStatus: row.shop_subscription_status,
      subscriptionEndsAt: row.shop_subscription_ends_at,
    },
    permissions: getEffectivePermissions(user),
  });
});

// @route POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401);
    throw new Error('Refresh token required');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Refresh token invalid or expired');
  }

  const { rows } = await query('SELECT id, shop_id, role, is_active FROM users WHERE id = $1', [
    decoded.userId,
  ]);
  const user = mapRow(rows[0]);
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error('User not found or deactivated');
  }

  const accessToken = generateAccessToken(tokenPayload(user));
  res.json({ success: true, accessToken });
});

// @route GET /api/auth/me
// Returns the shop too - otherwise a page refresh loses the shop name, since
// the client only receives it in the login response. Also carries
// subscription status/plan - DashboardLayout polls this to know whether to
// show the hard-lockout screen (see TrialExpiredOverlay), since that's the
// one thing that can change under a user without them doing anything (an
// admin manually expiring their trial from another session entirely).
const getMe = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, business_type, subscription_plan, subscription_status, subscription_ends_at FROM shops WHERE id = $1',
    [req.shopId]
  );

  // Same lazy expiry-flip as shopController.getShop - keeps this endpoint
  // (polled far more often, since every page load hits /auth/me) truthful
  // about status without a background job.
  let shopRow = rows[0];
  if (shopRow && shopRow.subscription_status === 'active' && shopRow.subscription_ends_at && new Date(shopRow.subscription_ends_at) < new Date()) {
    const { rows: updated } = await query(
      `UPDATE shops SET subscription_status = 'expired' WHERE id = $1
       RETURNING id, name, business_type, subscription_plan, subscription_status, subscription_ends_at`,
      [req.shopId]
    );
    shopRow = updated[0];
  }
  const shop = mapRow(shopRow);

  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      hasPin: req.user.hasPin,
    },
    shop: shop
      ? {
          id: shop._id,
          name: shop.name,
          businessType: shop.businessType,
          subscriptionPlan: shop.subscriptionPlan,
          subscriptionStatus: shop.subscriptionStatus,
          subscriptionEndsAt: shop.subscriptionEndsAt,
        }
      : null,
    shopId: req.shopId,
    role: req.role,
    permissions: req.permissions,
  });
});

// @route PUT /api/auth/profile - edit your own name/phone only
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  // Role, email and permissions are intentionally not editable here - changing
  // those is a staff-management action and goes through the shop routes.
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($1, name),
       phone = COALESCE($2, phone)
     WHERE id = $3
     RETURNING id, name, phone, role`,
    [name, phone, req.userId]
  );

  if (rows.length === 0) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({ success: true, data: mapRow(rows[0]) });
});

// @route PUT /api/auth/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const { rows } = await query('SELECT password FROM users WHERE id = $1', [req.userId]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('User not found');
  }

  // Requiring the current password stops someone using an unattended, logged-in
  // till to lock the owner out of their own account.
  if (!(await bcrypt.compare(currentPassword || '', rows[0].password))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, req.userId]);

  res.json({ success: true, message: 'Password updated' });
});

// @route PUT /api/auth/pin - set or change your own quick-switch PIN.
// Requires the current password for the same reason changePassword does: an
// unattended, already-logged-in till shouldn't let anyone standing at it
// silently add a low-friction backdoor into the account.
const setPin = asyncHandler(async (req, res) => {
  const { currentPassword, pin } = req.body;

  if (!/^\d{4,6}$/.test(pin || '')) {
    res.status(400);
    throw new Error('PIN must be 4 to 6 digits');
  }

  const { rows } = await query('SELECT password FROM users WHERE id = $1', [req.userId]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('User not found');
  }

  if (!(await bcrypt.compare(currentPassword || '', rows[0].password))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  const pinHash = await bcrypt.hash(pin, 10);
  await query(
    'UPDATE users SET pin = $1, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $2',
    [pinHash, req.userId]
  );

  res.json({ success: true, message: 'PIN set up' });
});

// @route DELETE /api/auth/pin - turn quick-switch off for your own account.
const removePin = asyncHandler(async (req, res) => {
  await query(
    'UPDATE users SET pin = NULL, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1',
    [req.userId]
  );
  res.json({ success: true, message: 'PIN removed' });
});

module.exports = {
  registerShopOwner,
  login,
  pinLogin,
  refresh,
  getMe,
  updateProfile,
  changePassword,
  setPin,
  removePin,
};
