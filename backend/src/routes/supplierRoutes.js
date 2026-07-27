const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/supplierController');

const router = express.Router();
router.use(protect);

const supplierValidation = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

router.route('/').get(getSuppliers).post(requireRole('owner', 'manager'), supplierValidation, validate, createSupplier);
router
  .route('/:id')
  .get(getSupplier)
  .put(requireRole('owner', 'manager'), updateSupplier)
  .delete(requireRole('owner', 'manager'), deleteSupplier);

module.exports = router;
