const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// GET /api/products?search=&categoryId=&lowStock=true&page=1&limit=20
const getProducts = asyncHandler(async (req, res) => {
  const { search, categoryId, lowStock, page = 1, limit = 20 } = req.query;

  const query = { shopId: req.shopId };
  if (categoryId) query.categoryId = categoryId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  if (lowStock === 'true') {
    query.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(query).populate('categoryId', 'name').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    data: products,
  });
});

const getProductByBarcode = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ shopId: req.shopId, barcode: req.params.barcode });
  if (!product) {
    res.status(404);
    throw new Error('Product not found for this barcode');
  }
  res.json({ success: true, data: product });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, shopId: req.shopId }).populate('categoryId', 'name');
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create({ ...req.body, shopId: req.shopId });
  res.status(201).json({ success: true, data: product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { shopId, ...updates } = req.body; // never allow shopId to be overwritten from body
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, shopId: req.shopId },
    updates,
    { new: true, runValidators: true }
  );
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.params.id, shopId: req.shopId });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, message: 'Product deleted' });
});

const adjustStock = asyncHandler(async (req, res) => {
  const { quantityChange, reason } = req.body;
  const product = await Product.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  const newQuantity = product.stockQuantity + Number(quantityChange);
  if (newQuantity < 0) {
    res.status(400);
    throw new Error('Stock quantity cannot go below zero');
  }
  product.stockQuantity = newQuantity;
  await product.save();
  res.json({ success: true, data: product, reason: reason || 'manual adjustment' });
});

module.exports = {
  getProducts,
  getProductByBarcode,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
};
