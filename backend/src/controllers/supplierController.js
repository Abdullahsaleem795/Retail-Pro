const asyncHandler = require('express-async-handler');
const Supplier = require('../models/Supplier');

const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { shopId: req.shopId };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  const suppliers = await Supplier.find(query).sort({ name: 1 });
  res.json({ success: true, count: suppliers.length, data: suppliers });
});

const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, data: supplier });
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create({ ...req.body, shopId: req.shopId });
  res.status(201).json({ success: true, data: supplier });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const { shopId, ...updates } = req.body;
  const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, updates, {
    new: true,
    runValidators: true,
  });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, data: supplier });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, shopId: req.shopId });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, message: 'Supplier deleted' });
});

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
