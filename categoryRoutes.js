const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getCategories)
  .post(authorize('owner', 'manager'), createCategory);

router.route('/:id')
  .put(authorize('owner', 'manager'), updateCategory)
  .delete(authorize('owner', 'manager'), deleteCategory);

module.exports = router;
