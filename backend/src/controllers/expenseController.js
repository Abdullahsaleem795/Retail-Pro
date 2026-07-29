const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const expenseCache = new Map();
const CACHE_TTL_MS = 15000;

const clearShopExpenseCache = (shopId) => {
  for (const key of expenseCache.keys()) {
    if (key.startsWith(`${shopId}:`)) {
      expenseCache.delete(key);
    }
  }
};

const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page = 1, limit = 20 } = req.query;

  const cacheKey = `${req.shopId}:${category || ''}:${from || ''}:${to || ''}:${page}:${limit}`;
  const cached = expenseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const conditions = ['shop_id = $1'];
  const params = [req.shopId];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const skip = (Number(page) - 1) * Number(limit);
  params.push(Number(limit), skip);

  const listResult = await query(
    `SELECT *, COUNT(*) OVER() AS full_count FROM expenses ${where} ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = listResult.rows.length > 0 ? Number(listResult.rows[0].full_count) : 0;

  const responsePayload = {
    success: true,
    count: listResult.rows.length,
    total,
    page: Number(page),
    data: mapRows(listResult.rows),
  };

  expenseCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

const createExpense = asyncHandler(async (req, res) => {
  const { category, title, amount, note, date } = req.body;
  const { rows } = await query(
    `INSERT INTO expenses (shop_id, category, title, amount, note, created_by, date)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now())) RETURNING *`,
    [req.shopId, category || 'other', title, amount, note, req.userId, date || null]
  );
  clearShopExpenseCache(req.shopId);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateExpense = asyncHandler(async (req, res) => {
  const { shopId, createdBy, ...body } = req.body;
  const { category, title, amount, note, date } = body;
  const { rows } = await query(
    `UPDATE expenses SET
       category = COALESCE($1, category), title = COALESCE($2, title),
       amount = COALESCE($3, amount), note = COALESCE($4, note), date = COALESCE($5, date)
     WHERE id = $6 AND shop_id = $7
     RETURNING *`,
    [category, title, amount, note, date, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Expense not found');
  }
  clearShopExpenseCache(req.shopId);
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM expenses WHERE id = $1 AND shop_id = $2 RETURNING id', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Expense not found');
  }
  clearShopExpenseCache(req.shopId);
  res.json({ success: true, message: 'Expense deleted' });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
