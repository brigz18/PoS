const asyncHandler = require('../utils/asyncHandler');
const Customer = require('../models/Customer');

const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { business: req.business._id };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const customers = await Customer.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: customers.length, data: customers });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, membership } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Customer name is required');
  }
  const customer = await Customer.create({ business: req.business._id, name, email, phone, membership });
  res.status(201).json({ success: true, data: customer });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, business: req.business._id });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  const editable = ['name', 'email', 'phone', 'membership', 'points', 'totalSpent'];
  for (const field of editable) {
    if (req.body[field] !== undefined) customer[field] = req.body[field];
  }

  await customer.save();
  res.json({ success: true, data: customer });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, business: req.business._id });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  await customer.deleteOne();
  res.json({ success: true, message: 'Customer deleted' });
});

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
