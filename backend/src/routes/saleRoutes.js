const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const validate = require('../middleware/validate');
const { getSales, getSale, createSale, refundSale, getSaleReceipt } = require('../controllers/saleController');

const router = express.Router();
router.use(protect);

const saleValidation = [body('items').isArray({ min: 1 }).withMessage('At least one item is required')];

router.route('/').get(getSales).post(saleValidation, validate, createSale);
router.get('/:id', getSale);
router.get('/:id/receipt', getSaleReceipt);
router.patch('/:id/refund', requirePermission(PERMISSIONS.SALE_REFUND), refundSale);

module.exports = router;
