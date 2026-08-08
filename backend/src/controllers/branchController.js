// Branches + stock transfer manifests for multi-location shops (wholesale
// tier). Transfers are a paper-trail/logistics record - "X units moved from
// Branch A to Branch B, confirmed received" - and deliberately do not split
// products.stock_quantity per branch. That would mean rewriting the POS's
// transactional stock-deduction path (SELECT...FOR UPDATE in saleController),
// which stays untouched here so the highest-risk part of the app isn't
// touched by this feature. See docs/knowledge-graph.md for the full rationale.
const asyncHandler = require('express-async-handler');
const { query, withTransaction } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

// ---------- Branches ----------

const getBranches = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM branches WHERE shop_id = $1 ORDER BY is_default DESC, name`,
    [req.shopId]
  );
  res.json({ success: true, count: rows.length, data: mapRows(rows) });
});

const createBranch = asyncHandler(async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Branch name is required');
  }

  const { rows } = await query(
    `INSERT INTO branches (shop_id, name, address, phone) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.shopId, name.trim(), address, phone]
  );
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateBranch = asyncHandler(async (req, res) => {
  const { name, address, phone, isActive } = req.body;
  const { rows } = await query(
    `UPDATE branches SET
       name = COALESCE($1, name), address = COALESCE($2, address),
       phone = COALESCE($3, phone), is_active = COALESCE($4, is_active)
     WHERE id = $5 AND shop_id = $6
     RETURNING *`,
    [name, address, phone, isActive, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Branch not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteBranch = asyncHandler(async (req, res) => {
  const existing = await query('SELECT is_default FROM branches WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (existing.rows.length === 0) {
    res.status(404);
    throw new Error('Branch not found');
  }
  if (existing.rows[0].is_default) {
    res.status(400);
    throw new Error('Cannot delete the default branch');
  }

  // No ON DELETE CASCADE from stock_transfers -> branches (RESTRICT is the
  // right default, same reasoning as products/suppliers elsewhere): a branch
  // with real transfer history should block deletion, not silently erase it.
  await query('DELETE FROM branches WHERE id = $1 AND shop_id = $2', [req.params.id, req.shopId]);
  res.json({ success: true, message: 'Branch deleted' });
});

// ---------- Stock transfers ----------

const TRANSFER_SELECT = `
  SELECT
    t.id, t.shop_id, t.status, t.notes, t.created_by, t.received_by,
    t.received_at, t.created_at, t.updated_at,
    jsonb_build_object('_id', fb.id, 'name', fb.name) AS from_branch_id,
    jsonb_build_object('_id', tb.id, 'name', tb.name) AS to_branch_id,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'productId', jsonb_build_object('_id', pr.id, 'name', pr.name, 'sku', pr.sku, 'unit', pr.unit),
          'quantity', ti.quantity
        ) ORDER BY ti.id)
       FROM stock_transfer_items ti JOIN products pr ON pr.id = ti.product_id
       WHERE ti.transfer_id = t.id),
      '[]'::jsonb
    ) AS items
  FROM stock_transfers t
  JOIN branches fb ON fb.id = t.from_branch_id
  JOIN branches tb ON tb.id = t.to_branch_id
`;

const getTransfers = asyncHandler(async (req, res) => {
  const { status, branchId } = req.query;
  const conditions = ['t.shop_id = $1'];
  const params = [req.shopId];
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (branchId) {
    params.push(branchId);
    conditions.push(`(t.from_branch_id = $${params.length} OR t.to_branch_id = $${params.length})`);
  }

  const { rows } = await query(
    `${TRANSFER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.created_at DESC`,
    params
  );
  res.json({ success: true, count: rows.length, data: mapRows(rows) });
});

const createTransfer = asyncHandler(async (req, res) => {
  const { fromBranchId, toBranchId, items, notes } = req.body;

  if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
    res.status(400);
    throw new Error('fromBranchId and toBranchId are required and must differ');
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
  }

  const branchCheck = await query(
    'SELECT id FROM branches WHERE id = ANY($1) AND shop_id = $2',
    [[fromBranchId, toBranchId], req.shopId]
  );
  if (branchCheck.rows.length !== 2) {
    res.status(404);
    throw new Error('One or both branches not found');
  }

  // Every item's productId must belong to this shop - without this check a
  // caller could reference another tenant's product UUID and have its name/
  // sku/unit disclosed back to them via this transfer's own response and
  // GET /api/branches/transfers (TRANSFER_SELECT joins products with no
  // shop_id filter, trusting this check to have already scoped it).
  const productIds = [...new Set(items.map((item) => item.productId))];
  const productCheck = await query('SELECT id FROM products WHERE id = ANY($1) AND shop_id = $2', [
    productIds,
    req.shopId,
  ]);
  if (productCheck.rows.length !== productIds.length) {
    res.status(404);
    throw new Error('One or more products not found');
  }

  const transferId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO stock_transfers (shop_id, from_branch_id, to_branch_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.shopId, fromBranchId, toBranchId, notes, req.userId]
    );
    const id = rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO stock_transfer_items (transfer_id, product_id, quantity) VALUES ($1,$2,$3)`,
        [id, item.productId, item.quantity]
      );
    }
    return id;
  });

  const { rows } = await query(`${TRANSFER_SELECT} WHERE t.id = $1`, [transferId]);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const markInTransit = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE stock_transfers SET status = 'in_transit'
     WHERE id = $1 AND shop_id = $2 AND status = 'pending' RETURNING id`,
    [req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(400);
    throw new Error('Transfer not found or not in a pending state');
  }
  const full = await query(`${TRANSFER_SELECT} WHERE t.id = $1`, [rows[0].id]);
  res.json({ success: true, data: mapRow(full.rows[0]) });
});

const receiveTransfer = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE stock_transfers SET status = 'received', received_by = $1, received_at = NOW()
     WHERE id = $2 AND shop_id = $3 AND status IN ('pending','in_transit') RETURNING id`,
    [req.userId, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(400);
    throw new Error('Transfer not found or already received/cancelled');
  }
  const full = await query(`${TRANSFER_SELECT} WHERE t.id = $1`, [rows[0].id]);
  res.json({ success: true, data: mapRow(full.rows[0]) });
});

const cancelTransfer = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE stock_transfers SET status = 'cancelled'
     WHERE id = $1 AND shop_id = $2 AND status != 'received' RETURNING id`,
    [req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(400);
    throw new Error('Transfer not found or already received');
  }
  const full = await query(`${TRANSFER_SELECT} WHERE t.id = $1`, [rows[0].id]);
  res.json({ success: true, data: mapRow(full.rows[0]) });
});

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getTransfers,
  createTransfer,
  markInTransit,
  receiveTransfer,
  cancelTransfer,
};
