const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page = 1, limit = 20 } = req.query;

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

  const [listResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM expenses ${where} ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    query(`SELECT COUNT(*) FROM expenses ${where}`, params.slice(0, params.length - 2)),
  ]);

  res.json({
    success: true,
    count: listResult.rows.length,
    total: Number(countResult.rows[0].count),
    page: Number(page),
    data: mapRows(listResult.rows),
  });
});

const createExpense = asyncHandler(async (req, res) => {
  const { category, title, amount, note, date } = req.body;
  const { rows } = await query(
    `INSERT INTO expenses (shop_id, category, title, amount, note, created_by, date)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now())) RETURNING *`,
    [req.shopId, category || 'other', title, amount, note, req.userId, date || null]
  );
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
  res.json({ success: true, message: 'Expense deleted' });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
