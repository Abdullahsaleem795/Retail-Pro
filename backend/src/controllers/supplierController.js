const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/sqlMapper');

const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const params = [req.shopId];
  let where = 'WHERE shop_id = $1';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  const { rows } = await query(`SELECT * FROM suppliers ${where} ORDER BY name`, params);
  const suppliers = mapRows(rows);
  res.json({ success: true, count: suppliers.length, data: suppliers });
});

const getSupplier = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM suppliers WHERE id = $1 AND shop_id = $2', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const createSupplier = asyncHandler(async (req, res) => {
  const { name, contactPerson, phone, email, address, notes } = req.body;
  const { rows } = await query(
    `INSERT INTO suppliers (shop_id, name, contact_person, phone, email, address, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.shopId, name, contactPerson, phone, email, address, notes]
  );
  res.status(201).json({ success: true, data: mapRow(rows[0]) });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const { shopId, ...body } = req.body;
  const { name, contactPerson, phone, email, address, notes, balance, isActive } = body;
  const { rows } = await query(
    `UPDATE suppliers SET
       name = COALESCE($1, name), contact_person = COALESCE($2, contact_person),
       phone = COALESCE($3, phone), email = COALESCE($4, email), address = COALESCE($5, address),
       notes = COALESCE($6, notes), balance = COALESCE($7, balance), is_active = COALESCE($8, is_active)
     WHERE id = $9 AND shop_id = $10
     RETURNING *`,
    [name, contactPerson, phone, email, address, notes, balance, isActive, req.params.id, req.shopId]
  );
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, data: mapRow(rows[0]) });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM suppliers WHERE id = $1 AND shop_id = $2 RETURNING id', [
    req.params.id,
    req.shopId,
  ]);
  if (rows.length === 0) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json({ success: true, message: 'Supplier deleted' });
});

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
