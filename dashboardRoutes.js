const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/auth');

router.get('/', protect, requirePermission('viewDashboard'), getDashboardStats);

module.exports = router;
