const express = require('express');
const { body } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getShop,
  updateShop,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/shopController');

const router = express.Router();
router.use(protect);

router.route('/').get(getShop).put(requireRole('owner'), updateShop);

const newUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

router
  .route('/users')
  .get(requireRole('owner', 'manager'), getUsers)
  .post(requireRole('owner'), newUserValidation, validate, createUser);

router
  .route('/users/:id')
  .put(requireRole('owner'), updateUser)
  .delete(requireRole('owner'), deleteUser);

module.exports = router;
