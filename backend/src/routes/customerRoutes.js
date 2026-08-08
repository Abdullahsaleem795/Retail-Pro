const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const validate = require('../middleware/validate');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

const router = express.Router();
router.use(protect);

const customerValidation = [body('name').trim().notEmpty().withMessage('Customer name is required')];

router
  .route('/')
  .get(getCustomers)
  .post(requirePermission(PERMISSIONS.CUSTOMER_MANAGE), customerValidation, validate, createCustomer);
router
  .route('/:id')
  .get(getCustomer)
  .put(requirePermission(PERMISSIONS.CUSTOMER_MANAGE), updateCustomer)
  .delete(requirePermission(PERMISSIONS.CUSTOMER_MANAGE), deleteCustomer);

module.exports = router;
