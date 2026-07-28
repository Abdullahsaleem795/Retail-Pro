const asyncHandler = require('express-async-handler');
const { query, withTransaction } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');
const { buildReceiptPDF } = require('../services/pdfService');

const generateReceiptNumber = () => `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// items.productId stays a plain id (not joined/populated) - the original
// Mongoose build never populated it here either, only customerId.
const SALE_SELECT = `
  SELECT
    s.id, s.shop_id, s.subtotal, s.discount, s.tax, s.total_amount, s.payment_method,
    s.amount_paid, s.status, s.cashier_id, s.receipt_number, s.client_ref,
    s.synced_from_offline, s.created_at, s.updated_at,
    CASE WHEN c.id IS NOT NULL
      THEN jsonb_build_object('_id', c.id, 'name', c.name, 'phone', c.phone)
      ELSE NULL END AS customer_id,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'productId', si.product_id, 'name', si.name, 'quantity', si.quantity,
          'unitPrice', si.unit_price, 'costPrice', si.cost_price, 'subtotal', si.subtotal
        ) ORDER BY si.id)
       FROM sale_items si WHERE si.sale_id = s.id),
      '[]'::jsonb
    ) AS items
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
`;

const fetchFullSale = async (id) => {
  const { rows } = await query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  return mapRow(rows[0]);
};

const getSales = asyncHandler(async (req, res) => {
  const { from, to, customerId, page = 1, limit = 20 } = req.query;

  const conditions = ['s.shop_id = $1'];
  const params = [req.shopId];
  if (customerId) {
    params.push(customerId);
    conditions.push(`s.customer_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`s.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`s.created_at <= $${params.length}`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const skip = (Number(page) - 1) * Number(limit);
  params.push(Number(limit), skip);

  const [listResult, countResult] = await Promise.all([
    query(
      `${SALE_SELECT} ${where} ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    query(`SELECT COUNT(*) FROM sales s ${where}`, params.slice(0, params.length - 2)),
  ]);

  res.json({
    success: true,
    count: listResult.rows.length,
    total: Number(countResult.rows[0].count),
    page: Number(page),
    data: mapRows(listResult.rows),
  });
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await fetchFullSale(req.params.id);
  if (!sale || sale.shopId !== req.shopId) {
    res.status(404);
    throw new Error('Sale not found');
  }
  res.json({ success: true, data: sale });
});

// The core POS transaction: validates stock for every line item, decrements it
// atomically, snapshots prices onto the sale (so later price edits don't rewrite
// history), and updates customer credit balance for 'credit' (khata) sales.
// Row locks (FOR UPDATE) plus the transaction mean a stock-out mid-checkout
// leaves nothing half-applied, and two concurrent sales can't both succeed
// against the same last unit of stock.
const createSale = asyncHandler(async (req, res) => {
  const {
    items, customerId, discount = 0, tax = 0, paymentMethod = 'cash', amountPaid,
    clientRef, syncedFromOffline = false,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Sale must contain at least one item');
  }

  // Idempotency: a retried offline sale must not be recorded twice. Return the
  // original receipt so the client can clear it from its queue as a success.
  if (clientRef) {
    const { rows } = await query('SELECT id FROM sales WHERE shop_id = $1 AND client_ref = $2', [
      req.shopId,
      clientRef,
    ]);
    if (rows.length > 0) {
      return res.status(200).json({ success: true, data: await fetchFullSale(rows[0].id), duplicate: true });
    }
  }

  let saleId;
  try {
    saleId = await withTransaction(async (client) => {
      const saleItems = [];
      let subtotal = 0;

      for (const line of items) {
        const productResult = await client.query(
          'SELECT * FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE',
          [line.productId, req.shopId]
        );
        if (productResult.rows.length === 0) {
          res.status(404);
          throw new Error(`Product ${line.productId} not found`);
        }
        const product = productResult.rows[0];
        if (Number(product.stock_quantity) < Number(line.quantity)) {
          res.status(400);
          throw new Error(`Insufficient stock for ${product.name} (available: ${product.stock_quantity})`);
        }

        const lineSubtotal = Number(product.selling_price) * Number(line.quantity);
        subtotal += lineSubtotal;

        saleItems.push({
          productId: product.id,
          name: product.name,
          quantity: line.quantity,
          unitPrice: product.selling_price,
          costPrice: product.cost_price,
          subtotal: lineSubtotal,
        });

        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND shop_id = $3',
          [line.quantity, product.id, req.shopId]
        );
      }

      const totalAmount = Math.max(subtotal - discount + tax, 0);
      const paid = amountPaid !== undefined ? amountPaid : totalAmount;

      if (paymentMethod === 'credit') {
        if (!customerId) {
          res.status(400);
          throw new Error('A customer is required for credit (khata) sales');
        }
        const customerResult = await client.query(
          'SELECT id FROM customers WHERE id = $1 AND shop_id = $2',
          [customerId, req.shopId]
        );
        if (customerResult.rows.length === 0) {
          res.status(404);
          throw new Error('Customer not found');
        }
        const unpaid = totalAmount - paid;
        if (unpaid > 0) {
          await client.query('UPDATE customers SET credit_balance = credit_balance + $1 WHERE id = $2', [
            unpaid,
            customerId,
          ]);
        }
      }

      const insertResult = await client.query(
        `INSERT INTO sales
           (shop_id, customer_id, subtotal, discount, tax, total_amount, payment_method,
            amount_paid, cashier_id, receipt_number, client_ref, synced_from_offline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          req.shopId, customerId || null, subtotal, discount, tax, totalAmount, paymentMethod,
          paid, req.userId, generateReceiptNumber(), clientRef || null, Boolean(syncedFromOffline),
        ]
      );
      const newSaleId = insertResult.rows[0].id;

      for (const item of saleItems) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, cost_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [newSaleId, item.productId, item.name, item.quantity, item.unitPrice, item.costPrice, item.subtotal]
        );
      }
      return newSaleId;
    });
  } catch (err) {
    // A unique-violation on (shop_id, client_ref) means a concurrent retry of
    // the same offline sale raced us and won - that's a success, not a bug,
    // so return the row that actually landed instead of a 500.
    if (err.code === '23505' && clientRef) {
      const { rows } = await query('SELECT id FROM sales WHERE shop_id = $1 AND client_ref = $2', [
        req.shopId,
        clientRef,
      ]);
      if (rows.length > 0) {
        return res.status(200).json({ success: true, data: await fetchFullSale(rows[0].id), duplicate: true });
      }
    }
    throw err;
  }

  return res.status(201).json({ success: true, data: await fetchFullSale(saleId) });
});

// Reverses stock for a sale (full refund only, mirrors real shop-counter behaviour).
const refundSale = asyncHandler(async (req, res) => {
  const saleId = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM sales WHERE id = $1 AND shop_id = $2 FOR UPDATE', [
      req.params.id,
      req.shopId,
    ]);
    if (rows.length === 0) {
      res.status(404);
      throw new Error('Sale not found');
    }
    const sale = rows[0];
    if (sale.status !== 'completed') {
      res.status(400);
      throw new Error(`Cannot refund a sale with status '${sale.status}'`);
    }

    const itemsResult = await client.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = $1', [
      sale.id,
    ]);
    for (const item of itemsResult.rows) {
      await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND shop_id = $3', [
        item.quantity,
        item.product_id,
        req.shopId,
      ]);
    }

    if (sale.payment_method === 'credit' && sale.customer_id) {
      const unpaid = Number(sale.total_amount) - Number(sale.amount_paid);
      if (unpaid > 0) {
        await client.query('UPDATE customers SET credit_balance = credit_balance - $1 WHERE id = $2', [
          unpaid,
          sale.customer_id,
        ]);
      }
    }

    await client.query(`UPDATE sales SET status = 'refunded' WHERE id = $1`, [sale.id]);
    return sale.id;
  });

  res.json({ success: true, data: await fetchFullSale(saleId) });
});

// GET /api/sales/:id/receipt - streams a printable PDF receipt
const getSaleReceipt = asyncHandler(async (req, res) => {
  const sale = await fetchFullSale(req.params.id);
  if (!sale || sale.shopId !== req.shopId) {
    res.status(404);
    throw new Error('Sale not found');
  }
  const { rows } = await query('SELECT name, address, phone FROM shops WHERE id = $1', [req.shopId]);
  buildReceiptPDF(sale, mapRow(rows[0]), res);
});

module.exports = { getSales, getSale, createSale, refundSale, getSaleReceipt };
