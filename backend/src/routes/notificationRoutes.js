const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendLowStockAlert,
  sendSupplierOrderDraft,
} = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/send-low-stock', requireRole('owner', 'manager'), sendLowStockAlert);
router.post('/supplier-order/:supplierId', requireRole('owner', 'manager'), sendSupplierOrderDraft);

module.exports = router;
