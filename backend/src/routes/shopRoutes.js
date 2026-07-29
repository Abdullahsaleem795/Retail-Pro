const express = require('express');
const { body } = require('express-validator');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const validate = require('../middleware/validate');
const {
  getShop,
  updateShop,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getGrantablePermissions,
  requestSubscriptionUpgrade,
  activateSubscription,
} = require('../controllers/shopController');

const router = express.Router();
router.use(protect);

router.route('/').get(getShop).put(requirePermission(PERMISSIONS.SHOP_SETTINGS), updateShop);

router.post('/subscription/request-upgrade', requirePermission(PERMISSIONS.SHOP_SETTINGS), requestSubscriptionUpgrade);
router.post('/subscription/activate', requirePermission(PERMISSIONS.SHOP_SETTINGS), activateSubscription);

// Exposed so the staff UI can render the permission checkboxes from one source
// of truth rather than duplicating the list on the client.
router.get('/permissions', requirePermission(PERMISSIONS.STAFF_MANAGE), getGrantablePermissions);

const newUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

router
  .route('/users')
  .get(requirePermission(PERMISSIONS.STAFF_MANAGE), getUsers)
  .post(requirePermission(PERMISSIONS.STAFF_MANAGE), newUserValidation, validate, createUser);

router
  .route('/users/:id')
  .put(requirePermission(PERMISSIONS.STAFF_MANAGE), updateUser)
  .delete(requirePermission(PERMISSIONS.STAFF_MANAGE), deleteUser);

module.exports = router;
