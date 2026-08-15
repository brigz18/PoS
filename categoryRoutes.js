const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect, requirePermission, checkSubscriptionActive } = require('../middleware/auth');

router.use(protect);
router.use(checkSubscriptionActive);
router.use(requirePermission('manageProducts'));

router.route('/').get(getCategories).post(createCategory);
router.route('/:id').put(updateCategory).delete(deleteCategory);

module.exports = router;
