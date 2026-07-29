const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const customerCache = new Map();
const CACHE_TTL_MS = 15000;

const clearShopCustomerCache = (shopId) => {
  for (const key of customerCache.keys()) {
    if (key.startsWith(`${shopId}:`)) {
      customerCache.delete(key);
    }
  }
};

const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const cacheKey = `${req.shopId}:${search || 'all'}`;
  const cached = customerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.response);
  }

  const params = [req.shopId];
  let where = 'WHERE shop_id = $1';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  const { rows } = await query(`SELECT * FROM customers ${where} ORDER BY name`, params);
  const customers = mapRows(rows);
  const responsePayload = { success: true, count: customers.length, data: customers };

  customerCache.set(cacheKey, { timestamp: Date.now(), response: responsePayload });
  res.json(responsePayload);
});

const getCustomer = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM customers WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, email, address } = req.body;
  const { rows } = await query(
    `INSERT INTO customers (shop_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.shopId, name, phone, email, address]
  );
  clearShopCustomerCache(req.shopId);
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { shopId, ...body } = req.body;
  const { name, phone, email, address, creditBalance, isActive } = body;
  const { rows } = await query(
    `UPDATE customers SET
       name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email),
       address = COALESCE($4, address), credit_balance = COALESCE($5, credit_balance),
       is_active = COALESCE($6, is_active)
     WHERE id = $7 AND shop_id = $8
     RETURNING *`,
    [name, phone, email, address, creditBalance, isActive, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Customer not found');
  }
  clearShopCustomerCache(req.shopId);
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM customers WHERE id = $1 AND shop_id = $2 RETURNING id', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Customer not found');
  }
  clearShopCustomerCache(req.shopId);
  res.json({ success: true, message: 'Customer deleted' });
});

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
