const express = require('express');
const { requirePlatformAdmin } = require('../middleware/platformAdmin');
const {
  listShops,
  activateSubscription,
  confirmActivationToken,
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
// One-click "Confirm & Activate" link from the upgrade-request email/WhatsApp
// ping - still behind requirePlatformAdmin above, same as every other route.
router.post('/subscription/confirm-token', confirmActivationToken);

router.route('/payment-accounts').get(getPaymentAccounts).put(updatePaymentAccounts);

// The operator's bank accounts are a list, not a single record - shops pick
// which one to transfer into (see GET /api/shop/payment-accounts).
router.route('/bank-accounts').get(listBankAccounts).post(createBankAccount);
router.route('/bank-accounts/:id').put(updateBankAccount).delete(deleteBankAccount);

module.exports = router;
