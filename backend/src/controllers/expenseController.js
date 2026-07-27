const asyncHandler = require('express-async-handler');
const Expense = require('../models/Expense');

const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page = 1, limit = 20 } = req.query;
  const query = { shopId: req.shopId };
  if (category) query.category = category;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [expenses, total] = await Promise.all([
    Expense.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)),
    Expense.countDocuments(query),
  ]);

  res.json({ success: true, count: expenses.length, total, page: Number(page), data: expenses });
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, shopId: req.shopId, createdBy: req.userId });
  res.status(201).json({ success: true, data: expense });
});

const updateExpense = asyncHandler(async (req, res) => {
  const { shopId, createdBy, ...updates } = req.body;
  const expense = await Expense.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, updates, {
    new: true,
    runValidators: true,
  });
  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }
  res.json({ success: true, data: expense });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, shopId: req.shopId });
  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }
  res.json({ success: true, message: 'Expense deleted' });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
