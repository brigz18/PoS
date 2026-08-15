const asyncHandler = require('../utils/asyncHandler');
const Business = require('../models/Business');

// @desc    Get the logged-in user's business
// @route   GET /api/business
// @access  Private (any logged-in account - Settings is visible to everyone,
//          just read-only for non-Owners; see updateBusiness below)
const getBusiness = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.business });
});

// @desc    Update business settings (name, currency symbol, tax rate)
// @route   PUT /api/business
// @access  Private - Owner only. The frontend already disables these fields
//          for non-Owners, but that's a UI courtesy, not a security
//          boundary - enforce it here too.
const updateBusiness = asyncHandler(async (req, res) => {
  if (req.user.role !== 'owner') {
    res.status(403);
    throw new Error('Only the business owner can update business settings');
  }

  const { name, currencySymbol, taxRate } = req.body;

  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      throw new Error('Business name is required');
    }
    req.business.name = name.trim();
  }
  if (currencySymbol !== undefined) {
    req.business.currencySymbol = currencySymbol.trim() || req.business.currencySymbol;
  }
  if (taxRate !== undefined) {
    const rate = Number(taxRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      res.status(400);
      throw new Error('Tax rate must be a number between 0 and 100');
    }
    req.business.taxRate = rate;
  }

  await req.business.save();
  res.json({ success: true, data: req.business });
});

module.exports = { getBusiness, updateBusiness };
