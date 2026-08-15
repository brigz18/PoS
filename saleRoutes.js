const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale } = require('../controllers/saleController');
const { protect, requirePermission, checkSubscriptionActive } = require('../middleware/auth');

router.use(protect);
router.use(checkSubscriptionActive);

// Creating a sale (checkout) and viewing sales history are gated by two
// different permissions in this app's model (see js/app.js PERMISSION_KEYS),
// so each route picks its own instead of the whole router sharing one.
router.post('/', requirePermission('usePOS'), createSale);
router.get('/', requirePermission('viewSalesHistory'), getSales);
router.get('/:id', requirePermission('viewSalesHistory'), getSale);

module.exports = router;
