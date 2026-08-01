const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale } = require('../controllers/saleController');
const { protect, requirePermission } = require('../middleware/auth');

router.use(protect);

// Checking out (creating a sale) is a POS-terminal action; browsing past
// sales is the separate "Sales History" permission. An employee can have
// either, both, or neither, independently of one another.
router.route('/')
  .get(requirePermission('viewSalesHistory'), getSales)
  .post(requirePermission('usePOS'), createSale);

router.get('/:id', requirePermission('viewSalesHistory'), getSale);

module.exports = router;
