const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
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

router.route('/').get(getPurchases).post(requirePermission(PERMISSIONS.PURCHASE_MANAGE), purchaseValidation, validate, createPurchase);
router.get('/:id', getPurchase);
router.patch('/:id/receive', requirePermission(PERMISSIONS.PURCHASE_MANAGE), markReceived);
router.patch('/:id/cancel', requirePermission(PERMISSIONS.PURCHASE_MANAGE), cancelPurchase);

module.exports = router;
