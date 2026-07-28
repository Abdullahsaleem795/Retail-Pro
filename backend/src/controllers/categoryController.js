const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const getCategories = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM categories WHERE shop_id = $1 ORDER BY name', [req.shopId]);
  const categories = mapRows(rows);
  res.json({ success: true, count: categories.length, data: categories });
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, nameUrdu, description } = req.body;
  const { rows } = await query(
    `INSERT INTO categories (shop_id, name, name_urdu, description) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.shopId, name, nameUrdu, description]
  );
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateCategory = asyncHandler(async (req, res) => {
  const { name, nameUrdu, description } = req.body;
  const { rows } = await query(
    `UPDATE categories SET
       name = COALESCE($1, name),
       name_urdu = COALESCE($2, name_urdu),
       description = COALESCE($3, description)
     WHERE id = $4 AND shop_id = $5
     RETURNING *`,
    [name, nameUrdu, description, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Category not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM categories WHERE id = $1 AND shop_id = $2 RETURNING id', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Category not found');
  }
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
