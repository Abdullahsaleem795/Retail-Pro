const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const { clearShopCategoryCache } = require('./categoryController');

const VALID_UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'dozen', 'box', 'packet'];
const BULK_IMPORT_MAX_ROWS = 500;

// Selecting explicit columns (rather than p.*) plus a joined category object
// keeps the populate-style shape (categoryId: {_id, name}) the frontend
// already expects from the Mongoose build, without a p.*/alias collision.
const PRODUCT_SELECT = `
  SELECT
    p.id, p.shop_id, p.name, p.name_urdu, p.sku, p.barcode, p.unit,
    p.cost_price, p.selling_price, p.stock_quantity, p.low_stock_threshold,
    p.expiry_date, p.expiry_alert_days, p.supplier_id, p.image_url, p.is_active,
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

// GET /api/products/expiry-alerts
// Only returns products whose owner opted into an alert (expiry_alert_days
// set) AND whose remaining shelf life has actually crossed into that
// window - not every product with an expiry date, and not alerts that
// haven't triggered yet. An already-expired product still matches (days
// remaining goes negative, which is still <= the threshold), which is the
// right behaviour: it shouldn't silently drop off the list once it's too
// late, that's the most urgent case.
const getExpiryAlerts = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, sku, barcode, unit, stock_quantity, expiry_date, expiry_alert_days,
       (expiry_date - CURRENT_DATE) AS days_remaining
     FROM products
     WHERE shop_id = $1 AND is_active = true
       AND expiry_date IS NOT NULL
       AND expiry_alert_days IS NOT NULL AND expiry_alert_days > 0
       AND (expiry_date - CURRENT_DATE) <= expiry_alert_days
     ORDER BY expiry_date ASC`,
    [req.shopId]
  );
  res.json({ success: true, count: rows.length, data: mapRows(rows) });
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
    costPrice, sellingPrice, stockQuantity, lowStockThreshold, expiryDate, expiryAlertDays, imageUrl,
  } = req.body;

  const { rows } = await query(
    `INSERT INTO products
       (shop_id, category_id, supplier_id, name, name_urdu, sku, barcode, unit,
        cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date,
        expiry_alert_days, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      req.shopId, categoryId || null, supplierId || null, name, nameUrdu, sku, barcode || null,
      unit || 'pcs', costPrice, sellingPrice, stockQuantity ?? 0, lowStockThreshold ?? 10,
      expiryDate || null, expiryAlertDays || null, imageUrl || null,
    ]
  );
  clearShopProductCache(req.shopId);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

// POST /api/products/bulk-import
// Accepts pre-parsed rows - the frontend owns CSV parsing and mapping the
// spreadsheet's human-friendly headers ("Cost Price", "Category") onto this
// same field shape createProduct/updateProduct already use, so this endpoint
// doesn't need its own parallel format to stay in sync with.
//
// Upserts on (shop_id, sku) rather than always inserting: re-running an
// import after fixing a handful of bad rows is safe and won't duplicate the
// rows that already succeeded. Each row is processed independently (no
// wrapping transaction) so one typo in a 200-row file doesn't roll back the
// other 199 - the response reports exactly which rows failed and why.
const bulkImportProducts = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.products) ? req.body.products : [];

  if (rows.length === 0) {
    res.status(400);
    throw new Error('No product rows provided');
  }
  if (rows.length > BULK_IMPORT_MAX_ROWS) {
    res.status(400);
    throw new Error(`Cannot import more than ${BULK_IMPORT_MAX_ROWS} products in one file`);
  }

  // Caches category name -> id for the duration of this one request, so 50
  // rows all naming a brand-new "Snacks" category create it exactly once
  // instead of racing duplicate inserts (the UNIQUE(shop_id, name) upsert
  // below is also safe on its own, but the cache avoids the redundant round
  // trips entirely for the common case of many rows sharing a category).
  const categoryCache = new Map();
  let categoriesChanged = false;

  const resolveCategoryId = async (categoryName) => {
    const trimmed = (categoryName || '').trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    if (categoryCache.has(key)) return categoryCache.get(key);

    const { rows: catRows } = await query(
      `INSERT INTO categories (shop_id, name) VALUES ($1, $2)
       ON CONFLICT (shop_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [req.shopId, trimmed]
    );
    categoriesChanged = true;
    categoryCache.set(key, catRows[0].id);
    return catRows[0].id;
  };

  const summary = { created: 0, updated: 0, failed: 0 };
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row in the file

    try {
      const name = String(row.name || '').trim();
      const sku = String(row.sku || '').trim();
      const costPrice = Number(row.costPrice);
      const sellingPrice = Number(row.sellingPrice);

      if (!name) throw new Error('Product name is required');
      if (!sku) throw new Error('SKU is required');
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw new Error('Cost price must be a positive number');
      }
      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        throw new Error('Selling price must be a positive number');
      }

      const unit = row.unit ? String(row.unit).trim().toLowerCase() : 'pcs';
      if (!VALID_UNITS.includes(unit)) {
        throw new Error(`Unit "${row.unit}" is not valid - must be one of ${VALID_UNITS.join(', ')}`);
      }

      let stockQuantity = 0;
      if (row.stockQuantity !== undefined && row.stockQuantity !== '') {
        stockQuantity = Number(row.stockQuantity);
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
          throw new Error('Stock quantity must be a positive number');
        }
      }

      let lowStockThreshold = 10;
      if (row.lowStockThreshold !== undefined && row.lowStockThreshold !== '') {
        lowStockThreshold = Number(row.lowStockThreshold);
        if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
          throw new Error('Low stock alert must be a positive number');
        }
      }

      let expiryDate = null;
      if (row.expiryDate && String(row.expiryDate).trim()) {
        expiryDate = String(row.expiryDate).trim();
        if (Number.isNaN(new Date(expiryDate).getTime())) {
          throw new Error(`Invalid expiry date "${row.expiryDate}" - use YYYY-MM-DD`);
        }
      }

      let expiryAlertDays = null;
      if (row.expiryAlertDays !== undefined && String(row.expiryAlertDays).trim() !== '') {
        expiryAlertDays = Number(row.expiryAlertDays);
        if (!Number.isInteger(expiryAlertDays) || expiryAlertDays < 0) {
          throw new Error('Expiry alert days must be a positive whole number');
        }
        if (!expiryDate) {
          throw new Error('Expiry alert days needs an expiry date on the same row');
        }
      }

      const categoryId = await resolveCategoryId(row.categoryName);

      const { rows: upserted } = await query(
        `INSERT INTO products
           (shop_id, category_id, name, sku, barcode, unit, cost_price, selling_price,
            stock_quantity, low_stock_threshold, expiry_date, expiry_alert_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (shop_id, sku) DO UPDATE SET
           category_id = EXCLUDED.category_id, name = EXCLUDED.name,
           barcode = EXCLUDED.barcode, unit = EXCLUDED.unit,
           cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price,
           stock_quantity = EXCLUDED.stock_quantity, low_stock_threshold = EXCLUDED.low_stock_threshold,
           expiry_date = EXCLUDED.expiry_date, expiry_alert_days = EXCLUDED.expiry_alert_days,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          req.shopId, categoryId, name, sku, String(row.barcode || '').trim() || null, unit,
          costPrice, sellingPrice, stockQuantity, lowStockThreshold, expiryDate, expiryAlertDays,
        ]
      );

      if (upserted[0].inserted) summary.created++;
      else summary.updated++;
    } catch (err) {
      summary.failed++;
      errors.push({ row: rowNumber, sku: row.sku || '(missing)', message: err.message });
    }
  }

  clearShopProductCache(req.shopId);
  if (categoriesChanged) clearShopCategoryCache(req.shopId);

  res.json({ success: true, summary, errors });
});

const updateProduct = asyncHandler(async (req, res) => {
  // Never allow shopId to be overwritten from the request body
  const { shopId, ...body } = req.body;
  const {
    name, nameUrdu, sku, barcode, categoryId, supplierId, unit,
    costPrice, sellingPrice, stockQuantity, lowStockThreshold, expiryDate, expiryAlertDays,
    imageUrl, isActive,
  } = body;

  const { rows } = await query(
    `UPDATE products SET
       name = COALESCE($1, name), name_urdu = COALESCE($2, name_urdu), sku = COALESCE($3, sku),
       barcode = COALESCE($4, barcode), category_id = COALESCE($5, category_id),
       supplier_id = COALESCE($6, supplier_id), unit = COALESCE($7, unit),
       cost_price = COALESCE($8, cost_price), selling_price = COALESCE($9, selling_price),
       stock_quantity = COALESCE($10, stock_quantity), low_stock_threshold = COALESCE($11, low_stock_threshold),
       expiry_date = COALESCE($12, expiry_date), expiry_alert_days = COALESCE($13, expiry_alert_days),
       image_url = COALESCE($14, image_url), is_active = COALESCE($15, is_active)
     WHERE id = $16 AND shop_id = $17
     RETURNING *`,
    [
      name, nameUrdu, sku, barcode, categoryId, supplierId, unit, costPrice, sellingPrice,
      stockQuantity, lowStockThreshold, expiryDate, expiryAlertDays, imageUrl, isActive,
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
  getExpiryAlerts,
  getProductByBarcode,
  getProduct,
  createProduct,
  bulkImportProducts,
  updateProduct,
  deleteProduct,
  adjustStock,
};
