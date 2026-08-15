const asyncHandler = require('../utils/asyncHandler');
const Supplier = require('../models/Supplier');

// @desc    List suppliers for the logged-in business
// @route   GET /api/suppliers
// @access  Private (requires manageSuppliers permission, or Owner)
const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find({ business: req.business._id }).sort({ name: 1 });
  res.json({ success: true, count: suppliers.length, data: suppliers });
});

// @desc    Create a supplier
// @route   POST /api/suppliers
// @access  Private (requires manageSuppliers permission, or Owner)
const createSupplier = asyncHandler(async (req, res) => {
  const { name, company, contactPerson, email, phone, address } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Supplier name is required');
  }

  const supplier = await Supplier.create({
    business: req.business._id,
    name: name.trim(),
    company: (company || '').trim(),
    contactPerson: (contactPerson || '').trim(),
    email: (email || '').trim(),
    phone: (phone || '').trim(),
    address: (address || '').trim(),
  });
  res.status(201).json({ success: true, data: supplier });
});

// @desc    Update a supplier (including active/inactive toggle)
// @route   PUT /api/suppliers/:id
// @access  Private (requires manageSuppliers permission, or Owner)
const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, business: req.business._id });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  const { name, company, contactPerson, email, phone, address, isActive } = req.body;
  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      throw new Error('Supplier name cannot be empty');
    }
    supplier.name = name.trim();
  }
  if (company !== undefined) supplier.company = company.trim();
  if (contactPerson !== undefined) supplier.contactPerson = contactPerson.trim();
  if (email !== undefined) supplier.email = email.trim();
  if (phone !== undefined) supplier.phone = phone.trim();
  if (address !== undefined) supplier.address = address.trim();
  if (isActive !== undefined) supplier.isActive = !!isActive;

  await supplier.save();
  res.json({ success: true, data: supplier });
});

// @desc    Delete a supplier
// @route   DELETE /api/suppliers/:id
// @access  Private (requires manageSuppliers permission, or Owner)
const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, business: req.business._id });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  await supplier.deleteOne();
  res.json({ success: true, message: 'Supplier deleted successfully' });
});

module.exports = { getSuppliers, createSupplier, updateSupplier, deleteSupplier };
