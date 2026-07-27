const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getPurchases,
  getPurchase,
  createPurchase,
  markReceived,
  cancelPurchase,
} = require('../controllers/purchaseController');

const router = express.Router();
router.use(protect);

const purchaseValidation = [
  body('supplierId').notEmpty().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
];

router.route('/').get(getPurchases).post(requireRole('owner', 'manager'), purchaseValidation, validate, createPurchase);
router.get('/:id', getPurchase);
router.patch('/:id/receive', requireRole('owner', 'manager'), markReceived);
router.patch('/:id/cancel', requireRole('owner', 'manager'), cancelPurchase);

module.exports = router;
