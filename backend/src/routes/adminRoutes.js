const express = require('express');
const { requirePlatformAdmin } = require('../middleware/platformAdmin');
const {
  listShops,
  activateSubscription,
  rejectSubscription,
  getPaymentAccounts,
  updatePaymentAccounts,
} = require('../controllers/adminController');

const router = express.Router();
router.use(requirePlatformAdmin);

router.get('/shops', listShops);
router.post('/shops/:shopId/subscription/activate', activateSubscription);
router.post('/shops/:shopId/subscription/reject', rejectSubscription);

router.route('/payment-accounts').get(getPaymentAccounts).put(updatePaymentAccounts);

module.exports = router;
