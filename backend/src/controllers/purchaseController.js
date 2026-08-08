const asyncHandler = require('express-async-handler');
const { query, withTransaction } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

// Nested keys inside jsonb_build_object are literal JSON string keys, not SQL
// column names, so they're written directly in the final camelCase shape the
// frontend expects (mapRow leaves already-camelCase keys untouched).
const PURCHASE_SELECT = `
  SELECT
    p.id, p.shop_id, p.total_amount, p.amount_paid, p.status, p.invoice_number,
    p.created_by, p.created_at, p.updated_at,
    jsonb_build_object('_id', s.id, 'name', s.name, 'phone', s.phone) AS supplier_id,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'productId', jsonb_build_object('_id', pr.id, 'name', pr.name, 'sku', pr.sku),
          'quantity', pi.quantity,
          'costPrice', pi.cost_price
        ) ORDER BY pi.id)
       FROM purchase_items pi JOIN products pr ON pr.id = pi.product_id
       WHERE pi.purchase_id = p.id),
      '[]'::jsonb
    ) AS items
  FROM purchases p
  JOIN suppliers s ON s.id = p.supplier_id
`;

const purchaseCache = new Map();
const CACHE_TTL_MS = 15000;

const clearShopPurchaseCache = (shopId) => {
  for (const key of purchaseCache.keys()) {
    if (key.startsWith(`${shopId}:`)) {
      purchaseCache.delete(key);
    }
  }
};

const getPurchases = asyncHandler(async (req, res) => {
  const { status, supplierId, page = 1, limit = 20 } = req.query;

  const cacheKey = `${req.shopId}:${status || ''}:${supplierId || ''}:${page}:${limit}`;
  const cached = purchaseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const conditions = ['p.shop_id = $1'];
  const params = [req.shopId];
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (supplierId) {
    params.push(supplierId);
    conditions.push(`p.supplier_id = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const skip = (Number(page) - 1) * Number(limit);
  params.push(Number(limit), skip);

  const listQuery = `
    SELECT
      p.id, p.shop_id, p.total_amount, p.amount_paid, p.status, p.invoice_number,
      p.created_by, p.created_at, p.updated_at,
      COUNT(*) OVER() AS full_count,
      jsonb_build_object('_id', s.id, 'name', s.name, 'phone', s.phone) AS supplier_id,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'productId', jsonb_build_object('_id', pr.id, 'name', pr.name, 'sku', pr.sku),
            'quantity', pi.quantity,
            'costPrice', pi.cost_price
          ) ORDER BY pi.id)
         FROM purchase_items pi JOIN products pr ON pr.id = pi.product_id
         WHERE pi.purchase_id = p.id),
        '[]'::jsonb
      ) AS items
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const listResult = await query(listQuery, params);
  const total = listResult.rows.length > 0 ? Number(listResult.rows[0].full_count) : 0;

  const responsePayload = {
    success: true,
    count: listResult.rows.length,
    total,
    page: Number(page),
    data: mapRows(listResult.rows),
  };

  purchaseCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

const getPurchase = asyncHandler(async (req, res) => {
  const { rows } = await query(`${PURCHASE_SELECT} WHERE p.id = $1 AND p.shop_id = $2`, [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Purchase not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

// Creates a purchase order in 'pending' status. Stock is only added once it's
// marked 'received' via markReceived, mirroring how goods actually arrive at a shop.
const createPurchase = asyncHandler(async (req, res) => {
  const { supplierId, items, amountPaid, invoiceNumber } = req.body;

  const supplierCheck = await query('SELECT id FROM suppliers WHERE id = $1 AND shop_id = $2', [
    supplierId,
    req.shopId,
  ]);
  if (supplierCheck.rows.length === 0) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  // Every item's productId must belong to this shop - without this check a
  // caller could reference another tenant's product UUID and have its name/
  // sku disclosed back via this purchase's own response and later GET calls
  // (PURCHASE_SELECT joins products with no shop_id filter, trusting this
  // check to have already scoped it). markReceived's stock UPDATE is itself
  // shop_id-scoped so a foreign product's stock can't actually be mutated,
  // but the cross-tenant disclosure is real.
  const productIds = [...new Set(items.map((item) => item.productId))];
  const productCheck = await query('SELECT id FROM products WHERE id = ANY($1) AND shop_id = $2', [
    productIds,
    req.shopId,
  ]);
  if (productCheck.rows.length !== productIds.length) {
    res.status(404);
    throw new Error('One or more products not found');
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

  const purchase = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO purchases (shop_id, supplier_id, total_amount, amount_paid, invoice_number, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.shopId, supplierId, totalAmount, amountPaid || 0, invoiceNumber, req.userId]
    );
    const purchaseId = rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES ($1,$2,$3,$4)`,
        [purchaseId, item.productId, item.quantity, item.costPrice]
      );
    }
    return purchaseId;
  });

  const { rows } = await query(`${PURCHASE_SELECT} WHERE p.id = $1`, [purchase]);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

// Marks a purchase as received: atomically increments product stock and
// updates the supplier's outstanding balance in a single transaction.
const markReceived = asyncHandler(async (req, res) => {
  const purchaseId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM purchases WHERE id = $1 AND shop_id = $2 FOR UPDATE',
      [req.params.id, req.shopId]
    );
    if (rows.length === 0) {
      res.status(404);
      throw new Error('Purchase not found');
    }
    const purchase = rows[0];
    if (purchase.status === 'received') {
      res.status(400);
      throw new Error('Purchase already marked as received');
    }
    if (purchase.status === 'cancelled') {
      res.status(400);
      throw new Error('Cannot receive a cancelled purchase');
    }

    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM purchase_items WHERE purchase_id = $1',
      [purchase.id]
    );
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND shop_id = $3',
        [item.quantity, item.product_id, req.shopId]
      );
    }

    const outstanding = Number(purchase.total_amount) - Number(purchase.amount_paid);
    if (outstanding > 0) {
      await client.query('UPDATE suppliers SET balance = balance + $1 WHERE id = $2 AND shop_id = $3', [
        outstanding,
        purchase.supplier_id,
        req.shopId,
      ]);
    }

    await client.query('UPDATE purchases SET status = $1 WHERE id = $2', ['received', purchase.id]);
    return purchase.id;
  });

  const { rows } = await query(`${PURCHASE_SELECT} WHERE p.id = $1`, [purchaseId]);
  res.json({ success: true, data: mapRow(rows[0]) });
});

const cancelPurchase = asyncHandler(async (req, res) => {
  const existing = await query('SELECT status FROM purchases WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (existing.rows.length === 0) {
    res.status(404);
    throw new Error('Purchase not found');
  }
  if (existing.rows[0].status === 'received') {
    res.status(400);
    throw new Error('Cannot cancel a purchase that has already been received');
  }

  const { rows } = await query(
    `UPDATE purchases SET status = 'cancelled' WHERE id = $1 AND shop_id = $2 RETURNING id`,
    [req.params.id, req.shopId]
  );
  const full = await query(`${PURCHASE_SELECT} WHERE p.id = $1`, [rows[0].id]);
  res.json({ success: true, data: mapRow(full.rows[0]) });
});

module.exports = { getPurchases, getPurchase, createPurchase, markReceived, cancelPurchase };
