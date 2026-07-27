const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');

const tokenPayload = (user) => ({
  userId: user._id,
  shopId: user.shopId,
  role: user.role,
});

// @route POST /api/auth/register
// Creates a new Shop plus its first user (owner). This is the only place a
// shopId is ever generated - every subsequent request derives shopId from the JWT.
const registerShopOwner = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array().map((e) => e.msg).join(', '));
  }

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
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    shop: { id: user.shopId._id, name: user.shopId.name, businessType: user.shopId.businessType },
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
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user, shopId: req.shopId, role: req.role });
});

module.exports = { registerShopOwner, login, refresh, getMe };
