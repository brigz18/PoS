const asyncHandler = require('../utils/asyncHandler');
const Supplier = require('../models/Supplier');

const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find({ business: req.business._id }).sort({ name: 1 });
  res.json({ success: true, count: suppliers.length, data: suppliers });
});

const createSupplier = asyncHandler(async (req, res) => {
  const { name, company, contactPerson, email, phone, address } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Supplier name is required');
  }
  const supplier = await Supplier.create({ business: req.business._id, name, company, contactPerson, email, phone, address });
  res.status(201).json({ success: true, data: supplier });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, business: req.business._id });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  const editable = ['name', 'company', 'contactPerson', 'email', 'phone', 'address', 'isActive'];
  for (const field of editable) {
    if (req.body[field] !== undefined) supplier[field] = req.body[field];
  }

  await supplier.save();
  res.json({ success: true, data: supplier });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, business: req.business._id });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  await supplier.deleteOne();
  res.json({ success: true, message: 'Supplier deleted' });
});

module.exports = { getSuppliers, createSupplier, updateSupplier, deleteSupplier };
