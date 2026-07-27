const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = (n) => {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
};

// GET /api/reports/dashboard - the numbers behind the dashboard stat cards
const getDashboardSummary = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const todayStart = startOfDay();

  const [todaySalesAgg, productStats, lowStockCount, pendingPurchases] = await Promise.all([
    Sale.aggregate([
      { $match: { shopId, status: 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { shopId, isActive: true } },
      { $group: { _id: null, count: { $sum: 1 }, stockValue: { $sum: { $multiply: ['$stockQuantity', '$costPrice'] } } } },
    ]),
    Product.countDocuments({ shopId, isActive: true, $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] } }),
    Purchase.countDocuments({ shopId, status: 'pending' }),
  ]);

  res.json({
    success: true,
    data: {
      todaySales: todaySalesAgg[0]?.total || 0,
      todayTransactions: todaySalesAgg[0]?.count || 0,
      productsInStock: productStats[0]?.count || 0,
      stockValue: productStats[0]?.stockValue || 0,
      lowStockItems: lowStockCount,
      pendingPurchases,
    },
  });
});

// GET /api/reports/sales-trend?days=14
const getSalesTrend = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const days = Math.min(Number(req.query.days) || 14, 90);

  const trend = await Sale.aggregate([
    { $match: { shopId, status: 'completed', createdAt: { $gte: daysAgo(days) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$totalAmount' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, data: trend });
});

// GET /api/reports/profit?from=&to=  - revenue vs cost vs expenses
const getProfitReport = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const from = req.query.from ? new Date(req.query.from) : daysAgo(30);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const [salesAgg, expenseAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { shopId, status: 'completed', createdAt: { $gte: from, $lte: to } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$items.subtotal' },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { shopId, date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenue = salesAgg[0]?.revenue || 0;
  const cogs = salesAgg[0]?.cost || 0;
  const expenses = expenseAgg[0]?.total || 0;
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;

  res.json({ success: true, data: { revenue, cogs, grossProfit, expenses, netProfit, from, to } });
});

// GET /api/reports/best-sellers?limit=10
const getBestSellers = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const days = Math.min(Number(req.query.days) || 30, 365);

  const bestSellers = await Sale.aggregate([
    { $match: { shopId, status: 'completed', createdAt: { $gte: daysAgo(days) } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        quantitySold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: limit },
  ]);

  res.json({ success: true, data: bestSellers });
});

// GET /api/reports/dead-stock?days=60 - products with zero sales in the window
const getDeadStock = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const days = Math.min(Number(req.query.days) || 60, 365);

  const soldProductIds = await Sale.aggregate([
    { $match: { shopId, status: 'completed', createdAt: { $gte: daysAgo(days) } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId' } },
  ]);

  const excludeIds = soldProductIds.map((p) => p._id);
  const deadStock = await Product.find({
    shopId,
    isActive: true,
    stockQuantity: { $gt: 0 },
    _id: { $nin: excludeIds },
  }).select('name sku stockQuantity costPrice sellingPrice createdAt');

  res.json({ success: true, count: deadStock.length, data: deadStock });
});

module.exports = { getDashboardSummary, getSalesTrend, getProfitReport, getBestSellers, getDeadStock };
