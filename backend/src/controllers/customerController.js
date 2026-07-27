const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');

const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { shopId: req.shopId };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  const customers = await Customer.find(query).sort({ name: 1 });
  res.json({ success: true, count: customers.length, data: customers });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: customer });
});

const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create({ ...req.body, shopId: req.shopId });
  res.status(201).json({ success: true, data: customer });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { shopId, ...updates } = req.body;
  const customer = await Customer.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, updates, {
    new: true,
    runValidators: true,
  });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: customer });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, shopId: req.shopId });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, message: 'Customer deleted' });
});

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
