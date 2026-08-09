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

const reportCache = new Map();
const CACHE_TTL_MS = 15000;

// GET /api/reports/dashboard - the numbers behind the dashboard stat cards
const getDashboardSummary = asyncHandler(async (req, res) => {
  const cacheKey = `summary:${req.shopId}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const todayStart = startOfDay();

  const { rows } = await query(
    `SELECT
       (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS today_sales,
       (SELECT COUNT(*) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS today_transactions,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true) AS products_in_stock,
       (SELECT COALESCE(SUM(stock_quantity * cost_price),0) FROM products WHERE shop_id = $1 AND is_active = true) AS stock_value,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true AND stock_quantity <= low_stock_threshold) AS low_stock_items,
       (SELECT COUNT(*) FROM purchases WHERE shop_id = $1 AND status = 'pending') AS pending_purchases`,
    [req.shopId, todayStart]
  );

  const row = rows[0] || {};
  const responsePayload = {
    success: true,
    data: {
      todaySales: Number(row.today_sales || 0),
      todayTransactions: Number(row.today_transactions || 0),
      productsInStock: Number(row.products_in_stock || 0),
      stockValue: Number(row.stock_value || 0),
      lowStockItems: Number(row.low_stock_items || 0),
      pendingPurchases: Number(row.pending_purchases || 0),
    },
  };

  reportCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

// GET /api/reports/dashboard-overview - Combined single-call for superfast Dashboard Home loading
const getDashboardOverview = asyncHandler(async (req, res) => {
  const cacheKey = `overview:${req.shopId}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const todayStart = startOfDay();
  const trendDaysAgo = daysAgo(14);
  const bestDaysAgo = daysAgo(30);
  const weekAgo = daysAgo(7);
  const twoWeeksAgo = daysAgo(14);

  const summaryResult = await query(
    `SELECT
       (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS today_sales,
       (SELECT COUNT(*) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS today_transactions,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true) AS products_in_stock,
       (SELECT COALESCE(SUM(stock_quantity * cost_price),0) FROM products WHERE shop_id = $1 AND is_active = true) AS stock_value,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true AND stock_quantity <= low_stock_threshold) AS low_stock_items,
       (SELECT COUNT(*) FROM purchases WHERE shop_id = $1 AND status = 'pending') AS pending_purchases,
       (SELECT COUNT(*) FROM customers WHERE shop_id = $1) AS total_customers,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true AND stock_quantity = 0) AS out_of_stock,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true AND stock_quantity > 0 AND stock_quantity <= low_stock_threshold) AS low_stock_only,
       (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_active = true AND stock_quantity > low_stock_threshold) AS healthy_stock`,
    [req.shopId, todayStart]
  );

  // "This week" = rolling last 7 days, "last week" = the 7 days before that -
  // simpler and more useful for a shop open every day than calendar-week
  // (Mon-Sun) boundaries, and matches what "vs last week" should mean day-to-day.
  const weekResult = await query(
    `SELECT
       (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS this_week_sales,
       (SELECT COUNT(*) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2) AS this_week_orders,
       (SELECT COALESCE(SUM(si.subtotal - si.cost_price * si.quantity),0)
          FROM sales s JOIN sale_items si ON si.sale_id = s.id
          WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2) AS this_week_profit,
       (SELECT COALESCE(SUM(si.quantity),0)
          FROM sales s JOIN sale_items si ON si.sale_id = s.id
          WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2) AS this_week_items,
       (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $3 AND created_at < $2) AS last_week_sales,
       (SELECT COUNT(*) FROM sales WHERE shop_id = $1 AND status = 'completed' AND created_at >= $3 AND created_at < $2) AS last_week_orders,
       (SELECT COALESCE(SUM(si.subtotal - si.cost_price * si.quantity),0)
          FROM sales s JOIN sale_items si ON si.sale_id = s.id
          WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $3 AND s.created_at < $2) AS last_week_profit,
       (SELECT COUNT(*) FROM customers WHERE shop_id = $1 AND created_at >= $3 AND created_at < $2) AS last_week_new_customers,
       (SELECT COUNT(*) FROM customers WHERE shop_id = $1 AND created_at >= $2) AS this_week_new_customers`,
    [req.shopId, weekAgo, twoWeeksAgo]
  );

  const trendResult = await query(
    `SELECT created_at::date::text AS id, SUM(total_amount) AS total, COUNT(*) AS transactions
     FROM sales
     WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2
     GROUP BY created_at::date
     ORDER BY id ASC`,
    [req.shopId, trendDaysAgo]
  );

  const bestResult = await query(
    `SELECT si.product_id AS id, MIN(si.name) AS name, MIN(p.sku) AS sku,
            SUM(si.quantity) AS quantity_sold, SUM(si.subtotal) AS revenue
     FROM sales s JOIN sale_items si ON si.sale_id = s.id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at >= $2
     GROUP BY si.product_id
     ORDER BY quantity_sold DESC
     LIMIT 5`,
    [req.shopId, bestDaysAgo]
  );

  const recentSalesResult = await query(
    `SELECT s.id, s.receipt_number, s.total_amount, s.status, s.created_at,
       CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('_id', c.id, 'name', c.name) ELSE NULL END AS customer_id
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.shop_id = $1
     ORDER BY s.created_at DESC
     LIMIT 5`,
    [req.shopId]
  );

  const row = summaryResult.rows[0] || {};
  const wk = weekResult.rows[0] || {};
  const responsePayload = {
    success: true,
    data: {
      summary: {
        todaySales: Number(row.today_sales || 0),
        todayTransactions: Number(row.today_transactions || 0),
        productsInStock: Number(row.products_in_stock || 0),
        stockValue: Number(row.stock_value || 0),
        lowStockItems: Number(row.low_stock_items || 0),
        pendingPurchases: Number(row.pending_purchases || 0),
        totalCustomers: Number(row.total_customers || 0),
      },
      stockBreakdown: {
        inStock: Number(row.healthy_stock || 0),
        lowStock: Number(row.low_stock_only || 0),
        outOfStock: Number(row.out_of_stock || 0),
      },
      weekComparison: {
        thisWeek: {
          sales: Number(wk.this_week_sales || 0),
          orders: Number(wk.this_week_orders || 0),
          profit: Number(wk.this_week_profit || 0),
          itemsSold: Number(wk.this_week_items || 0),
          newCustomers: Number(wk.this_week_new_customers || 0),
        },
        lastWeek: {
          sales: Number(wk.last_week_sales || 0),
          orders: Number(wk.last_week_orders || 0),
          profit: Number(wk.last_week_profit || 0),
          newCustomers: Number(wk.last_week_new_customers || 0),
        },
      },
      trend: mapRows(trendResult.rows).map((r) => ({ _id: r._id, total: Number(r.total), transactions: Number(r.transactions) })),
      bestSellers: mapRows(bestResult.rows).map((r) => ({ _id: r._id, name: r.name, sku: r.sku, quantitySold: Number(r.quantitySold), revenue: Number(r.revenue) })),
      recentSales: mapRows(recentSalesResult.rows).map((r) => ({
        _id: r._id,
        receiptNumber: r.receiptNumber,
        totalAmount: Number(r.totalAmount),
        status: r.status,
        createdAt: r.createdAt,
        customerId: r.customerId,
      })),
    },
  };

  reportCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

// GET /api/reports/sales-trend?days=14
const getSalesTrend = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  const cacheKey = `trend:${req.shopId}:${days}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const { rows } = await query(
    `SELECT created_at::date::text AS id, SUM(total_amount) AS total, COUNT(*) AS transactions
     FROM sales
     WHERE shop_id = $1 AND status = 'completed' AND created_at >= $2
     GROUP BY created_at::date
     ORDER BY id ASC`,
    [req.shopId, daysAgo(days)]
  );

  const responsePayload = {
    success: true,
    data: mapRows(rows).map((r) => ({ _id: r._id, total: Number(r.total), transactions: Number(r.transactions) })),
  };

  reportCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
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
  const cacheKey = `best:${req.shopId}:${limit}:${days}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

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

  const responsePayload = {
    success: true,
    data: mapRows(rows).map((r) => ({
      _id: r._id,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    })),
  };

  reportCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
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
  getDashboardOverview,
  getDashboardSummary,
  getSalesTrend,
  getProfitReport,
  getBestSellers,
  getDeadStock,
  getFastMoving,
  getLowMargin,
  getReorderSuggestions,
};
