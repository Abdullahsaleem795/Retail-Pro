const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const categoryCache = new Map();
const CACHE_TTL_MS = 30000;

const clearShopCategoryCache = (shopId) => {
  for (const key of categoryCache.keys()) {
    if (key.startsWith(`${shopId}:`)) {
      categoryCache.delete(key);
    }
  }
};

const getCategories = asyncHandler(async (req, res) => {
  const cacheKey = `${req.shopId}:all`;
  const cached = categoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const { rows } = await query('SELECT * FROM categories WHERE shop_id = $1 ORDER BY name', [req.shopId]);
  const categories = mapRows(rows);
  const responsePayload = { success: true, count: categories.length, data: categories };

  categoryCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, nameUrdu, description } = req.body;
  const { rows } = await query(
    `INSERT INTO categories (shop_id, name, name_urdu, description) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.shopId, name, nameUrdu, description]
  );
  clearShopCategoryCache(req.shopId);
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
  clearShopCategoryCache(req.shopId);
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
  clearShopCategoryCache(req.shopId);
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, clearShopCategoryCache };
