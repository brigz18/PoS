const express = require('express');
const router = express.Router();
const { getInventoryOverview, getMovements, adjustStock } = require('../controllers/inventoryController');
const { protect, requirePermission, checkSubscriptionActive } = require('../middleware/auth');

router.use(protect);
router.use(checkSubscriptionActive);
router.use(requirePermission('manageInventory'));

router.get('/', getInventoryOverview);
router.get('/movements', getMovements);
router.post('/adjust', adjustStock);

module.exports = router;
