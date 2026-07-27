const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getDashboardSummary,
  getSalesTrend,
  getProfitReport,
  getBestSellers,
  getDeadStock,
  getFastMoving,
  getLowMargin,
  getReorderSuggestions,
} = require('../controllers/reportController');

const router = express.Router();
router.use(protect);

router.get('/dashboard', getDashboardSummary);
router.get('/sales-trend', getSalesTrend);
router.get('/profit', getProfitReport);
router.get('/best-sellers', getBestSellers);
router.get('/dead-stock', getDeadStock);
router.get('/fast-moving', getFastMoving);
router.get('/low-margin', getLowMargin);
router.get('/reorder', getReorderSuggestions);

module.exports = router;
