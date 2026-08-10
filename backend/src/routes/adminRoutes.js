const express = require('express');
const { requirePlatformAdmin } = require('../middleware/platformAdmin');
const {
  listShops,
  activateSubscription,
  rejectSubscription,
  getPaymentAccounts,
  updatePaymentAccounts,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} = require('../controllers/adminController');

const router = express.Router();
router.use(requirePlatformAdmin);

router.get('/shops', listShops);
router.post('/shops/:shopId/subscription/activate', activateSubscription);
router.post('/shops/:shopId/subscription/reject', rejectSubscription);

router.route('/payment-accounts').get(getPaymentAccounts).put(updatePaymentAccounts);

// The operator's bank accounts are a list, not a single record - shops pick
// which one to transfer into (see GET /api/shop/payment-accounts).
router.route('/bank-accounts').get(listBankAccounts).post(createBankAccount);
router.route('/bank-accounts/:id').put(updateBankAccount).delete(deleteBankAccount);

module.exports = router;
