const express = require('express');
const router = express.Router();
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, requirePermission, checkSubscriptionActive } = require('../middleware/auth');

router.use(protect);
router.use(checkSubscriptionActive);
router.use(requirePermission('manageProducts'));

router.route('/').get(getProducts).post(createProduct);
router.route('/:id').put(updateProduct).delete(deleteProduct);

module.exports = router;
