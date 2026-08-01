const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, requirePermission } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getCategories) // open to any authenticated employee - needed to render the POS/Products category filters
  .post(requirePermission('manageProducts'), createCategory);

router.route('/:id')
  .put(requirePermission('manageProducts'), updateCategory)
  .delete(requirePermission('manageProducts'), deleteCategory);

module.exports = router;
