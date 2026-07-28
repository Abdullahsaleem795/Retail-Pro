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
    shop: { id: shop._id, name: shop.name, businessType: shop.businessType },
  });
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT u.*, s.id AS shop_pk, s.name AS shop_name, s.business_type AS shop_business_type,
            s.is_active AS shop_is_active
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
    user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: row.shop_pk, name: row.shop_name, businessType: row.shop_business_type },
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
// the client only receives it in the login response.
const getMe = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name, business_type FROM shops WHERE id = $1', [req.shopId]);
  const shop = mapRow(rows[0]);

  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
    },
    shop: shop ? { id: shop._id, name: shop.name, businessType: shop.businessType } : null,
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

module.exports = { registerShopOwner, login, refresh, getMe, updateProfile, changePassword };
