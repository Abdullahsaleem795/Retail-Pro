const express = require('express');
const { body } = require('express-validator');
const {
  registerShopOwner,
  login,
  pinLogin,
  refresh,
  getMe,
  updateProfile,
  changePassword,
  setPin,
  removePin,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('shopName').trim().notEmpty().withMessage('Shop name is required'),
    body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  registerShopOwner
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post(
  '/pin-login',
  [
    body('userId').isUUID().withMessage('Valid userId is required'),
    body('pin').matches(/^\d{4,6}$/).withMessage('PIN must be 4 to 6 digits'),
  ],
  validate,
  pinLogin
);

router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put(
  '/password',
  protect,
  [body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')],
  validate,
  changePassword
);
router.put(
  '/pin',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('pin').matches(/^\d{4,6}$/).withMessage('PIN must be 4 to 6 digits'),
  ],
  validate,
  setPin
);
router.delete('/pin', protect, removePin);

module.exports = router;
