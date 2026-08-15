const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');
const { protect, requirePermission, checkSubscriptionActive } = require('../middleware/auth');

router.use(protect);
router.use(checkSubscriptionActive);
router.use(requirePermission('manageCustomers'));

router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').put(updateCustomer).delete(deleteCustomer);

module.exports = router;
