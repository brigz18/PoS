const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getCustomers) // all roles (cashiers need this at checkout)
  .post(authorize('owner', 'manager', 'cashier'), createCustomer);

router.route('/:id')
  .put(authorize('owner', 'manager'), updateCustomer)
  .delete(authorize('owner', 'manager'), deleteCustomer);

module.exports = router;
