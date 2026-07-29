const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

// Selecting explicit columns (rather than p.*) plus a joined category object
// keeps the populate-style shape (categoryId: {_id, name}) the frontend
// already expects from the Mongoose build, without a p.*/alias collision.
const PRODUCT_SELECT = `
  SELECT
    p.id, p.shop_id, p.name, p.name_urdu, p.sku, p.barcode, p.unit,
    p.cost_price, p.selling_price, p.stock_quantity, p.low_stock_threshold,
    p.expiry_date, p.supplier_id, p.image_url, p.is_active,
    p.created_at, p.updated_at,
    CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('_id', c.id, 'name', c.name) ELSE NULL END AS category_id,
    (SELECT COUNT(*) FROM products WHERE shop_id = p.shop_id) AS full_count
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

const productCache = new Map();
const CACHE_TTL_MS = 15000;

const clearShopProductCache = (shopId) => {
  for (const key of productCache.keys()) {
    if (key.startsWith(`${shopId}:`)) {
      productCache.delete(key);
    }
  }
};

// GET /api/products?search=&categoryId=&lowStock=true&page=1&limit=20
const getProducts = asyncHandler(async (req, res) => {
  const { search, categoryId, lowStock, page = 1, limit = 20 } = req.query;

  const cacheKey = `${req.shopId}:${search || ''}:${categoryId || ''}:${lowStock || ''}:${page}:${limit}`;
  const cached = productCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const conditions = ['p.shop_id = $1'];
  const params = [req.shopId];

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i} OR p.barcode ILIKE $${i})`);
  }
  if (lowStock === 'true') {
    conditions.push('p.stock_quantity <= p.low_stock_threshold');
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const skip = (Number(page) - 1) * Number(limit);

  params.push(Number(limit), skip);
  const listQuery = `${PRODUCT_SELECT} ${where} ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const listResult = await query(listQuery, params);
  const total = listResult.rows.length > 0 ? Number(listResult.rows[0].full_count) : 0;

  const responsePayload = {
    success: true,
    count: listResult.rows.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit) || 1,
    data: mapRows(listResult.rows),
  };

  productCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

const getProductByBarcode = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM products WHERE shop_id = $1 AND barcode = $2', [
    req.shopId,
    req.params.barcode,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Product not found for this barcode');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const getProduct = asyncHandler(async (req, res) => {
  const { rows } = await query(`${PRODUCT_SELECT} WHERE p.id = $1 AND p.shop_id = $2`, [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const createProduct = asyncHandler(async (req, res) => {
  const {
    name, nameUrdu, sku, barcode, categoryId, supplierId, unit,
    costPrice, sellingPrice, stockQuantity, lowStockThreshold, expiryDate, imageUrl,
  } = req.body;

  const { rows } = await query(
    `INSERT INTO products
       (shop_id, category_id, supplier_id, name, name_urdu, sku, barcode, unit,
        cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      req.shopId, categoryId || null, supplierId || null, name, nameUrdu, sku, barcode || null,
      unit || 'pcs', costPrice, sellingPrice, stockQuantity ?? 0, lowStockThreshold ?? 10,
      expiryDate || null, imageUrl || null,
    ]
  );
  clearShopProductCache(req.shopId);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateProduct = asyncHandler(async (req, res) => {
  // Never allow shopId to be overwritten from the request body
  const { shopId, ...body } = req.body;
  const {
    name, nameUrdu, sku, barcode, categoryId, supplierId, unit,
    costPrice, sellingPrice, stockQuantity, lowStockThreshold, expiryDate, imageUrl, isActive,
  } = body;

  const { rows } = await query(
    `UPDATE products SET
       name = COALESCE($1, name), name_urdu = COALESCE($2, name_urdu), sku = COALESCE($3, sku),
       barcode = COALESCE($4, barcode), category_id = COALESCE($5, category_id),
       supplier_id = COALESCE($6, supplier_id), unit = COALESCE($7, unit),
       cost_price = COALESCE($8, cost_price), selling_price = COALESCE($9, selling_price),
       stock_quantity = COALESCE($10, stock_quantity), low_stock_threshold = COALESCE($11, low_stock_threshold),
       expiry_date = COALESCE($12, expiry_date), image_url = COALESCE($13, image_url),
       is_active = COALESCE($14, is_active)
     WHERE id = $15 AND shop_id = $16
     RETURNING *`,
    [
      name, nameUrdu, sku, barcode, categoryId, supplierId, unit, costPrice, sellingPrice,
      stockQuantity, lowStockThreshold, expiryDate, imageUrl, isActive,
      req.params.id, req.shopId,
    ]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Product not found');
  }
  clearShopProductCache(req.shopId);
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM products WHERE id = $1 AND shop_id = $2 RETURNING id', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Product not found');
  }
  clearShopProductCache(req.shopId);
  res.json({ success: true, message: 'Product deleted' });
});

const adjustStock = asyncHandler(async (req, res) => {
  const { quantityChange, reason } = req.body;

  const { rows } = await query(
    `UPDATE products SET stock_quantity = stock_quantity + $1
     WHERE id = $2 AND shop_id = $3 AND stock_quantity + $1 >= 0
     RETURNING *`,
    [Number(quantityChange), req.params.id, req.shopId]
  );

  if (rows.length === 0) {
    // Distinguish "doesn't exist" from "would go negative" the same way the
    // Mongoose version did, since the frontend surfaces different messages.
    const exists = await query('SELECT stock_quantity FROM products WHERE id = $1 AND shop_id = $2', [
      req.params.id,
      req.shopId,
    ]);
    if (exists.rows.length === 0) {
      res.status(404);
      throw new Error('Product not found');
    }
    res.status(400);
    throw new Error('Stock quantity cannot go below zero');
  }

  res.json({ success: true, data: mapRow(rows[0]), reason: reason || 'manual adjustment' });
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
