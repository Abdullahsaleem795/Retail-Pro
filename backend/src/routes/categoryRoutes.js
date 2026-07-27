const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

router.use(protect);

router.route('/').get(getCategories).post(requireRole('owner', 'manager'), createCategory);
router
  .route('/:id')
  .put(requireRole('owner', 'manager'), updateCategory)
  .delete(requireRole('owner', 'manager'), deleteCategory);

module.exports = router;
