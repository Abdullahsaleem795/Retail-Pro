const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const validate = require('../middleware/validate');
const {
  getProducts,
  getProductByBarcode,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} = require('../controllers/productController');

const router = express.Router();

router.use(protect);

const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
];

router
  .route('/')
  .get(getProducts)
  .post(requirePermission(PERMISSIONS.PRODUCT_MANAGE), productValidation, validate, createProduct);

router.get('/barcode/:barcode', getProductByBarcode);

router
  .route('/:id')
  .get(getProduct)
  .put(requirePermission(PERMISSIONS.PRODUCT_MANAGE), updateProduct)
  .delete(requirePermission(PERMISSIONS.PRODUCT_MANAGE), deleteProduct);

router.patch('/:id/stock', adjustStock);

module.exports = router;
