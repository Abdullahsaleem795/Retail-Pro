const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getDashboardSummary,
  getSalesTrend,
  getProfitReport,
  getBestSellers,
  getDeadStock,
} = require('../controllers/reportController');

const router = express.Router();
router.use(protect);

router.get('/dashboard', getDashboardSummary);
router.get('/sales-trend', getSalesTrend);
router.get('/profit', getProfitReport);
router.get('/best-sellers', getBestSellers);
router.get('/dead-stock', getDeadStock);

module.exports = router;
