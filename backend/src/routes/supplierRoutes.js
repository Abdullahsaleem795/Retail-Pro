const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
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

router.route('/').get(getSuppliers).post(requirePermission(PERMISSIONS.SUPPLIER_MANAGE), supplierValidation, validate, createSupplier);
router
  .route('/:id')
  .get(getSupplier)
  .put(requirePermission(PERMISSIONS.SUPPLIER_MANAGE), updateSupplier)
  .delete(requirePermission(PERMISSIONS.SUPPLIER_MANAGE), deleteSupplier);

module.exports = router;
