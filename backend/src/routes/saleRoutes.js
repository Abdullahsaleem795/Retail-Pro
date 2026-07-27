const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const { getSales, getSale, createSale, refundSale } = require('../controllers/saleController');

const router = express.Router();
router.use(protect);

const saleValidation = [body('items').isArray({ min: 1 }).withMessage('At least one item is required')];

router.route('/').get(getSales).post(saleValidation, createSale);
router.get('/:id', getSale);
router.patch('/:id/refund', requireRole('owner', 'manager'), refundSale);

module.exports = router;
