const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale } = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(authorize('owner', 'manager', 'cashier'), getSales)
  .post(authorize('owner', 'manager', 'cashier'), createSale);

router.get('/:id', authorize('owner', 'manager', 'cashier'), getSale);

module.exports = router;
