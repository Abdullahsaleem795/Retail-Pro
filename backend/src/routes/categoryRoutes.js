const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

router.use(protect);

router.route('/').get(getCategories).post(requirePermission(PERMISSIONS.CATEGORY_MANAGE), createCategory);
router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.CATEGORY_MANAGE), updateCategory)
  .delete(requirePermission(PERMISSIONS.CATEGORY_MANAGE), deleteCategory);

module.exports = router;
