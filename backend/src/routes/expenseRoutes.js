const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');

const router = express.Router();
router.use(protect);

const expenseValidation = [
  body('title').trim().notEmpty().withMessage('Expense title is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
];

router.route('/').get(getExpenses).post(expenseValidation, validate, createExpense);
router
  .route('/:id')
  .put(requireRole('owner', 'manager'), updateExpense)
  .delete(requireRole('owner', 'manager'), deleteExpense);

module.exports = router;
