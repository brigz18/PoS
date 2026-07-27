const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getProducts) // all roles can view products (needed for POS terminal)
  .post(authorize('owner', 'manager', 'inventory_staff'), createProduct);

router.route('/:id')
  .get(getProduct)
  .put(authorize('owner', 'manager', 'inventory_staff'), updateProduct)
  .delete(authorize('owner', 'manager'), deleteProduct);

module.exports = router;
