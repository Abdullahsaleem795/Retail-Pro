const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
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
router.post('/send-low-stock', requirePermission(PERMISSIONS.NOTIFICATION_SEND), sendLowStockAlert);
router.post('/supplier-order/:supplierId', requirePermission(PERMISSIONS.NOTIFICATION_SEND), sendSupplierOrderDraft);

module.exports = router;
