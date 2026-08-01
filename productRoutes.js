const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, requirePermission } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getProducts) // open to any authenticated employee - the POS terminal needs the product list regardless of their other permissions
  .post(requirePermission('manageProducts'), createProduct);

router.route('/:id')
  .get(getProduct)
  .put(requirePermission('manageProducts'), updateProduct)
  .delete(requirePermission('manageProducts'), deleteProduct);

module.exports = router;
