const asyncHandler = require('../utils/asyncHandler');
const Customer = require('../models/Customer');

const buildCustomerFilter = (req) => {
  const filter = { business: req.business._id };
  if (req.query.search) {
    const re = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  return filter;
};

// @desc    List customers for the logged-in business
// @route   GET /api/customers
// @access  Private (requires manageCustomers permission, or Owner)
const getCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.find(buildCustomerFilter(req)).sort({ name: 1 });
  res.json({ success: true, count: customers.length, data: customers });
});

// @desc    Create a customer
// @route   POST /api/customers
// @access  Private (requires manageCustomers permission, or Owner)
const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, membership } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Customer name is required');
  }

  const customer = await Customer.create({
    business: req.business._id,
    name: name.trim(),
    email: (email || '').trim(),
    phone: (phone || '').trim(),
    membership: membership || undefined,
  });
  res.status(201).json({ success: true, data: customer });
});

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private (requires manageCustomers permission, or Owner)
const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, business: req.business._id });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  const { name, email, phone, membership } = req.body;
  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      throw new Error('Customer name cannot be empty');
    }
    customer.name = name.trim();
  }
  if (email !== undefined) customer.email = email.trim();
  if (phone !== undefined) customer.phone = phone.trim();
  if (membership !== undefined) customer.membership = membership;

  await customer.save();
  res.json({ success: true, data: customer });
});

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private (requires manageCustomers permission, or Owner)
const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, business: req.business._id });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  await customer.deleteOne();
  res.json({ success: true, message: 'Customer deleted successfully' });
});

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
