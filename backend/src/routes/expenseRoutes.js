const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
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
  .put(requirePermission(PERMISSIONS.EXPENSE_MANAGE), updateExpense)
  .delete(requirePermission(PERMISSIONS.EXPENSE_MANAGE), deleteExpense);

module.exports = router;
