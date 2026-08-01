const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const { protect, requirePermission } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getCustomers) // open to any authenticated employee - the POS terminal needs this for "select customer" at checkout
  .post(requirePermission('manageCustomers'), createCustomer);

router.route('/:id')
  .put(requirePermission('manageCustomers'), updateCustomer)
  .delete(requirePermission('manageCustomers'), deleteCustomer);

module.exports = router;
