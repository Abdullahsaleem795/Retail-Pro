const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
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

router.route('/').get(getCustomers).post(customerValidation, createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);

module.exports = router;
