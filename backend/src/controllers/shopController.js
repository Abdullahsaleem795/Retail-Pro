const asyncHandler = require('express-async-handler');
const Shop = require('../models/Shop');
const User = require('../models/User');

const getShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.shopId);
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }
  res.json({ success: true, data: shop });
});

// Only whitelisted fields are updatable - subscriptionPlan and isActive are
// billing/admin concerns and must never be settable by a tenant.
const UPDATABLE_FIELDS = [
  'name',
  'businessType',
  'ownerName',
  'phone',
  'email',
  'address',
  'city',
  'logoUrl',
  'language',
  'whatsappNumber',
  'lowStockThreshold',
];

const updateShop = asyncHandler(async (req, res) => {
  const updates = {};
  UPDATABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const shop = await Shop.findByIdAndUpdate(req.shopId, updates, { new: true, runValidators: true });
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }
  res.json({ success: true, data: shop });
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ shopId: req.shopId }).select('-password').sort({ createdAt: 1 });
  res.json({ success: true, count: users.length, data: users });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  // A shop can only ever have one owner; staff are managers or cashiers.
  if (role === 'owner') {
    res.status(400);
    throw new Error('A shop can only have one owner');
  }

  const user = await User.create({
    shopId: req.shopId,
    name,
    email,
    password,
    phone,
    role: role || 'cashier',
  });

  res.status(201).json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, role, isActive } = req.body;

  if (role === 'owner') {
    res.status(400);
    throw new Error('Cannot promote a user to owner');
  }

  const target = await User.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!target) {
    res.status(404);
    throw new Error('User not found');
  }
  if (target.role === 'owner') {
    res.status(403);
    throw new Error('The shop owner account cannot be modified here');
  }

  Object.assign(target, {
    ...(name !== undefined && { name }),
    ...(phone !== undefined && { phone }),
    ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive }),
  });
  await target.save();

  res.json({ success: true, data: { id: target._id, name: target.name, role: target.role, isActive: target.isActive } });
});

const deleteUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!target) {
    res.status(404);
    throw new Error('User not found');
  }
  if (target.role === 'owner') {
    res.status(403);
    throw new Error('The shop owner account cannot be deleted');
  }
  if (String(target._id) === String(req.userId)) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  await target.deleteOne();
  res.json({ success: true, message: 'User removed' });
});

module.exports = { getShop, updateShop, getUsers, createUser, updateUser, deleteUser };
