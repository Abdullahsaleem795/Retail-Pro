const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const startOfDay = (d = new Date()) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const daysAgo = (n) => {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
};

// GET /api/reports/dashboard - the numbers behind the dashboard stat cards
const getDashboardSummary = asyncHandler(async (req, res) => {
  const todayStart = startOfDay();

  const [salesResult, productResult, lowStockResult, pendingResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2`,
      [req.shopId, todayStart]
    ),
    query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(stock_quantity * cost_price),0) AS stock_value
       FROM products WHERE shop_id = $1 AND is_active = true`,
      [req.shopId]
    ),
    query(
      `SELECT COUNT(*) FROM products
       WHERE shop_id = $1 AND is_active = true AND stock_quantity <= low_stock_threshold`,
      [req.shopId]
    ),
    query(`SELECT COUNT(*) FROM purchases WHERE shop_id = $1 AND status = 'pending'`, [req.shopId]),
  ]);

  res.json({
    success: true,
    data: {
      todaySales: Number(salesResult.rows[0].total),
      todayTransactions: Number(salesResult.rows[0].count),
      productsInStock: Number(productResult.rows[0].count),
      stockValue: Number(productResult.rows[0].stock_value),
      lowStockItems: Number(lowStockResult.rows[0].count),
      pendingPurchases: Number(pendingResult.rows[0].count),
    },
  });
});

// GET /api/reports/sales-trend?days=14
const getSalesTrend = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);

  // Aliasing the grouped date string as `id` deliberately reuses the shared
  // row-mapper's id -> _id rename, matching what the frontend already reads
  // off Mongo's { $group: { _id: dateString } } shape (DashboardHome.jsx
  // does `d._id.slice(5)`).
  const { rows } = await query(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS id, SUM(total_amount) AS total, COUNT(*) AS transactions
     FROM sales
     WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2
     GROUP BY to_char(created_at, 'YYYY-MM-DD')
     ORDER BY id ASC`,
    [req.shopId, daysAgo(days)]
  );

  res.json({
    success: true,
    data: mapRows(rows).map((r) => ({ _id: r._id, total: Number(r.total), transactions: Number(r.transactions) })),
  });
});

// GET /api/reports/profit?from=&to=  - revenue vs cost vs expenses
const getProfitReport = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : daysAgo(30);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const [salesResult, expenseResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(si.subtotal),0) AS revenue, COALESCE(SUM(si.cost_price * si.quantity),0) AS cost
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at BETWEEN $2 AND $3`,
      [req.shopId, from, to]
    ),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id = $1 AND date BETWEEN $2 AND $3`, [
      req.shopId,
      from,
      to,
    ]),
  ]);

  const revenue = Number(salesResult.rows[0].revenue);
  const cogs = Number(salesResult.rows[0].cost);
  const expenses = Number(expenseResult.rows[0].total);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;

  res.json({ success: true, data: { revenue, cogs, grossProfit, expenses, netProfit, from, to } });
});

// GET /api/reports/best-sellers?limit=10
const getBestSellers = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const days = Math.min(Number(req.query.days) || 30, 365);

  const { rows } = await query(
    `SELECT si.product_id AS id, MIN(si.name) AS name,
            SUM(si.quantity) AS quantity_sold, SUM(si.subtotal) AS revenue
     FROM sales s JOIN sale_items si ON si.sale_id = s.id
     WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2
     GROUP BY si.product_id
     ORDER BY quantity_sold DESC
     LIMIT $3`,
    [req.shopId, daysAgo(days), limit]
  );

  res.json({
    success: true,
    data: mapRows(rows).map((r) => ({
      _id: r._id,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    })),
  });
});

// GET /api/reports/dead-stock?days=60 - products with zero sales in the window
const getDeadStock = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 60, 365);

  const { rows } = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity, p.cost_price, p.selling_price, p.created_at
     FROM products p
     WHERE p.shop_id = $1 AND p.is_active = true AND p.stock_quantity > 0
       AND NOT EXISTS (
         SELECT 1 FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = p.id AND s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2
       )`,
    [req.shopId, daysAgo(days)]
  );

  const deadStock = mapRows(rows);
  res.json({ success: true, count: deadStock.length, data: deadStock });
});

// GET /api/reports/fast-moving?days=30
// Ranks products by average units sold per day. "Days of cover" is the key
// number for a shopkeeper: at the current rate, how long until this runs out.
const getFastMoving = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);

  const { rows } = await query(
    `WITH movement AS (
       SELECT si.product_id, SUM(si.quantity) AS total_sold
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2
       GROUP BY si.product_id
     )
     SELECT p.id, p.name, p.sku, p.unit, p.stock_quantity, m.total_sold
     FROM movement m JOIN products p ON p.id = m.product_id AND p.shop_id = $1
     ORDER BY m.total_sold DESC
     LIMIT 25`,
    [req.shopId, daysAgo(days)]
  );

  const movement = mapRows(rows).map((m) => {
    const totalSold = Number(m.totalSold);
    const dailyRate = Number((totalSold / days).toFixed(2));
    const daysOfCover = dailyRate > 0 ? Math.floor(Number(m.stockQuantity) / dailyRate) : null;
    return {
      _id: m._id,
      name: m.name,
      sku: m.sku,
      unit: m.unit,
      totalSold,
      stockQuantity: Number(m.stockQuantity),
      dailyRate,
      daysOfCover,
      // Flag anything that will run out before a typical weekly restock trip
      needsRestock: daysOfCover !== null && daysOfCover < 7,
    };
  });

  res.json({ success: true, count: movement.length, data: movement });
});

// GET /api/reports/low-margin?threshold=15
// Surfaces products whose markup is thin enough that they may be sold at a
// loss once shop overheads are counted.
const getLowMargin = asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold) || 15;

  const { rows } = await query(
    `SELECT id, name, sku, cost_price, selling_price, stock_quantity
     FROM products WHERE shop_id = $1 AND is_active = true AND cost_price > 0`,
    [req.shopId]
  );

  const lowMargin = mapRows(rows)
    .map((p) => {
      const profit = Number(p.sellingPrice) - Number(p.costPrice);
      const marginPercent = (profit / Number(p.sellingPrice)) * 100;
      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
        stockQuantity: Number(p.stockQuantity),
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
  const days = Math.min(Number(req.query.days) || 30, 365);
  const coverDays = Math.min(Number(req.query.coverDays) || 14, 90);

  const [demandResult, productResult] = await Promise.all([
    query(
      `SELECT si.product_id, SUM(si.quantity) AS total_sold
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2
       GROUP BY si.product_id`,
      [req.shopId, daysAgo(days)]
    ),
    query(
      `SELECT p.id, p.name, p.sku, p.unit, p.stock_quantity, p.low_stock_threshold, p.cost_price,
              CASE WHEN sup.id IS NOT NULL
                THEN jsonb_build_object('name', sup.name, 'phone', sup.phone)
                ELSE NULL END AS supplier
       FROM products p LEFT JOIN suppliers sup ON sup.id = p.supplier_id
       WHERE p.shop_id = $1 AND p.is_active = true`,
      [req.shopId]
    ),
  ]);

  const demandMap = Object.fromEntries(demandResult.rows.map((d) => [d.product_id, Number(d.total_sold)]));

  const suggestions = mapRows(productResult.rows)
    .map((p) => {
      const sold = demandMap[p._id] || 0;
      const dailyRate = sold / days;
      const projectedNeed = Math.ceil(dailyRate * coverDays);
      const shortfall = projectedNeed - Number(p.stockQuantity);

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        stockQuantity: Number(p.stockQuantity),
        soldInPeriod: sold,
        dailyRate: Number(dailyRate.toFixed(2)),
        projectedNeed,
        suggestedOrderQty: shortfall > 0 ? shortfall : 0,
        estimatedCost: shortfall > 0 ? shortfall * Number(p.costPrice) : 0,
        supplier: p.supplier || null,
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
