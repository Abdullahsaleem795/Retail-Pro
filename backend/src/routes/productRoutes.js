const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
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
  .post(requireRole('owner', 'manager'), productValidation, createProduct);

router.get('/barcode/:barcode', getProductByBarcode);

router
  .route('/:id')
  .get(getProduct)
  .put(requireRole('owner', 'manager'), updateProduct)
  .delete(requireRole('owner', 'manager'), deleteProduct);

router.patch('/:id/stock', adjustStock);

module.exports = router;
