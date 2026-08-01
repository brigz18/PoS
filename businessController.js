const asyncHandler = require('../utils/asyncHandler');
const Business = require('../models/Business');

// @desc    Get the logged-in user's business details
// @route   GET /api/business
// @access  Private (any authenticated role)
const getBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.business._id);
  res.json({ success: true, data: business });
});

// @desc    Update business settings (name, currency, tax rate, timezone)
// @route   PUT /api/business
// @access  Private (owner only)
const updateBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.business._id);
  if (!business) {
    res.status(404);
    throw new Error('Business not found');
  }

  // Whitelist: subscription/billing fields (plan, maxUsers, maxBranches,
  // subscriptionStatus) are intentionally NOT editable here - those should
  // only ever change through a billing/upgrade flow, not a generic settings form.
  const editable = ['name', 'currency', 'currencySymbol', 'taxRate', 'timezone'];
  for (const field of editable) {
    if (req.body[field] !== undefined) business[field] = req.body[field];
  }

  if (business.taxRate !== undefined && (business.taxRate < 0 || business.taxRate > 100)) {
    res.status(400);
    throw new Error('Tax rate must be between 0 and 100');
  }

  await business.save();
  res.json({ success: true, data: business });
});

module.exports = { getBusiness, updateBusiness };
