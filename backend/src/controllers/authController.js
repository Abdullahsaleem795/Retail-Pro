const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { getEffectivePermissions } = require('../config/permissions');

const tokenPayload = (user) => ({
  userId: user._id,
  shopId: user.shopId,
  role: user.role,
});

// @route POST /api/auth/register
// Creates a new Shop plus its first user (owner). This is the only place a
// shopId is ever generated - every subsequent request derives shopId from the JWT.
const registerShopOwner = asyncHandler(async (req, res) => {
  const { shopName, businessType, ownerName, phone, email, password, city } = req.body;

  const shop = await Shop.create({
    name: shopName,
    businessType,
    ownerName,
    phone,
    email,
    city,
  });

  const user = await User.create({
    shopId: shop._id,
    name: ownerName,
    email,
    password,
    phone,
    role: 'owner',
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

  const user = await User.findOne({ email }).select('+password').populate('shopId', 'name businessType isActive');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive || !user.shopId?.isActive) {
    res.status(403);
    throw new Error('Account or shop is deactivated');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken(tokenPayload(user));
  const refreshToken = generateRefreshToken(tokenPayload(user));

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: user.shopId._id, name: user.shopId.name, businessType: user.shopId.businessType },
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

  const user = await User.findById(decoded.userId);
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
  const shop = await Shop.findById(req.shopId).select('name businessType currency language');
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

  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Role, email and permissions are intentionally not editable here - changing
  // those is a staff-management action and goes through the shop routes.
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  res.json({ success: true, data: { _id: user._id, name: user.name, phone: user.phone, role: user.role } });
});

// @route PUT /api/auth/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.userId).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Requiring the current password stops someone using an unattended, logged-in
  // till to lock the owner out of their own account.
  if (!(await user.comparePassword(currentPassword || ''))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword; // hashed by the pre-save hook
  await user.save();

  res.json({ success: true, message: 'Password updated' });
});

module.exports = { registerShopOwner, login, refresh, getMe, updateProfile, changePassword };
