const express = require('express');
const router = express.Router();
const { getBusiness, updateBusiness } = require('../controllers/businessController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getBusiness);
router.put('/', authorize('owner'), updateBusiness);

module.exports = router;
