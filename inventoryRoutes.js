const express = require('express');
const router = express.Router();
const { getInventoryOverview, getMovements, adjustStock } = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('owner', 'manager', 'inventory_staff'));

router.get('/', getInventoryOverview);
router.get('/movements', getMovements);
router.post('/adjust', adjustStock);

module.exports = router;
