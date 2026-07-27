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

// GET /api/reports/fast-moving?days=30
// Ranks products by average units sold per day. "Days of cover" is the key
// number for a shopkeeper: at the current rate, how long until this runs out.
const getFastMoving = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const days = Math.min(Number(req.query.days) || 30, 365);

  const movement = await Sale.aggregate([
    { $match: { shopId, status: 'completed', createdAt: { $gte: daysAgo(days) } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        totalSold: { $sum: '$items.quantity' },
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { pid: '$_id' },
        // The shopId match inside the lookup keeps the join tenant-scoped too
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$pid'] }, { $eq: ['$shopId', shopId] }] } } }],
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        name: 1,
        sku: '$product.sku',
        unit: '$product.unit',
        totalSold: 1,
        stockQuantity: '$product.stockQuantity',
        dailyRate: { $divide: ['$totalSold', days] },
      },
    },
    {
      $addFields: {
        daysOfCover: {
          $cond: [{ $gt: ['$dailyRate', 0] }, { $divide: ['$stockQuantity', '$dailyRate'] }, null],
        },
      },
    },
    { $sort: { dailyRate: -1 } },
    { $limit: 25 },
  ]);

  res.json({
    success: true,
    count: movement.length,
    data: movement.map((m) => ({
      ...m,
      dailyRate: Number(m.dailyRate.toFixed(2)),
      daysOfCover: m.daysOfCover === null ? null : Math.floor(m.daysOfCover),
      // Flag anything that will run out before a typical weekly restock trip
      needsRestock: m.daysOfCover !== null && m.daysOfCover < 7,
    })),
  });
});

// GET /api/reports/low-margin?threshold=15
// Surfaces products whose markup is thin enough that they may be sold at a
// loss once shop overheads are counted.
const getLowMargin = asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold) || 15;

  const products = await Product.find({
    shopId: req.shopId,
    isActive: true,
    costPrice: { $gt: 0 },
  }).select('name sku costPrice sellingPrice stockQuantity');

  const lowMargin = products
    .map((p) => {
      const profit = p.sellingPrice - p.costPrice;
      const marginPercent = (profit / p.sellingPrice) * 100;
      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
        profitPerUnit: profit,
        marginPercent: Number(marginPercent.toFixed(1)),
        isLoss: profit < 0,
      };
    })
    .filter((p) => p.marginPercent < threshold)
    .sort((a, b) => a.marginPercent - b.marginPercent);

  res.json({ success: true, threshold, count: lowMargin.length, data: lowMargin });
});

// GET /api/reports/reorder?days=30&coverDays=14
// Demand-based reorder suggestions. Deliberately a transparent moving average
// rather than a black-box forecast: a shopkeeper can sanity-check "sold 60 in
// 30 days, so ~2/day, so order enough for 2 weeks" and trust it.
const getReorderSuggestions = asyncHandler(async (req, res) => {
  const shopId = new mongoose.Types.ObjectId(req.shopId);
  const days = Math.min(Number(req.query.days) || 30, 365);
  const coverDays = Math.min(Number(req.query.coverDays) || 14, 90);

  const demand = await Sale.aggregate([
    { $match: { shopId, status: 'completed', createdAt: { $gte: daysAgo(days) } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' } } },
  ]);

  const demandMap = Object.fromEntries(demand.map((d) => [String(d._id), d.totalSold]));

  const products = await Product.find({ shopId, isActive: true })
    .select('name sku unit stockQuantity lowStockThreshold costPrice supplierId')
    .populate('supplierId', 'name phone');

  const suggestions = products
    .map((p) => {
      const sold = demandMap[String(p._id)] || 0;
      const dailyRate = sold / days;
      const projectedNeed = Math.ceil(dailyRate * coverDays);
      const shortfall = projectedNeed - p.stockQuantity;

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        soldInPeriod: sold,
        dailyRate: Number(dailyRate.toFixed(2)),
        projectedNeed,
        suggestedOrderQty: shortfall > 0 ? shortfall : 0,
        estimatedCost: shortfall > 0 ? shortfall * p.costPrice : 0,
        supplier: p.supplierId ? { name: p.supplierId.name, phone: p.supplierId.phone } : null,
      };
    })
    .filter((s) => s.suggestedOrderQty > 0)
    .sort((a, b) => b.estimatedCost - a.estimatedCost);

  const totalCost = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

  res.json({ success: true, coverDays, count: suggestions.length, totalEstimatedCost: totalCost, data: suggestions });
});

module.exports = {
  getDashboardSummary,
  getSalesTrend,
  getProfitReport,
  getBestSellers,
  getDeadStock,
  getFastMoving,
  getLowMargin,
  getReorderSuggestions,
};
