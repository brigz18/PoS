const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');
const User = require('../models/User');
const Business = require('../models/Business');
const Payment = require('../models/Payment');
const { PLAN_CATALOG, SUBSCRIPTION_DAYS } = require('./paymentController');
const { ALL_GRANTED } = require('../utils/permissions');

// @desc    Register a new business + owner account (platform sign-up)
//          Requires a completed, unused payment reference from
//          POST /api/payments/checkout - registration is the moment that
//          payment reference gets "spent" to actually create the business.
// @route   POST /api/auth/register-business
// @access  Public
const registerBusiness = asyncHandler(async (req, res) => {
  const { businessName, ownerName, email, password, phone, paymentReference } = req.body;

  if (!businessName || !ownerName || !email || !password) {
    res.status(400);
    throw new Error('businessName, ownerName, email and password are required');
  }
  if (!paymentReference) {
    res.status(402);
    throw new Error('A completed payment is required before registering a business. Please choose a plan and pay first.');
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const payment = await Payment.findOne({ reference: paymentReference });
  if (!payment) {
    res.status(404);
    throw new Error('Payment reference not found');
  }
  if (payment.status !== 'completed') {
    res.status(402);
    throw new Error('This payment was not completed successfully');
  }
  if (payment.consumedAt) {
    res.status(400);
    throw new Error('This payment reference has already been used to register a business');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    res.status(400);
    throw new Error('An account with this email already exists. Your payment is still valid and has not been used yet - just try a different email address to finish registering.');
  }

  const planLimits = PLAN_CATALOG[payment.plan] || PLAN_CATALOG.starter;
  const now = new Date();
  const subscriptionExpiresAt = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  // Business.ownerUser and User.business are BOTH required fields, so neither
  // document can be saved first without the other already existing (and
  // passing `ownerUser: undefined` to Business.create() does NOT work around
  // this - Mongoose validates required fields immediately on create(), so it
  // throws "Path `ownerUser` is required" before any patch-up step can run).
  // Fix: pre-generate the owner's _id, create the Business with it, THEN
  // create the User using that exact same _id. One save each, no patch-up.
  const ownerId = new mongoose.Types.ObjectId();

  const business = await Business.create({
    name: businessName,
    ownerUser: ownerId,
    subscriptionPlan: payment.plan,
    subscriptionStatus: 'active',
    subscriptionExpiresAt,
    lastPaymentReference: payment.reference,
    lastPaymentAt: now,
    maxUsers: planLimits.maxUsers,
    maxBranches: planLimits.maxBranches,
  });

  const owner = await User.create({
    _id: ownerId,
    business: business._id,
    name: ownerName,
    email: email.toLowerCase(),
    password,
    role: 'owner',
    // Purely informational - the Owner role always bypasses permission checks
    // in requirePermission() regardless of this object, but storing it as
    // "all granted" keeps the Employees table's display logic uniform for
    // every account instead of special-casing the Owner row.
    permissions: ALL_GRANTED,
    phone: phone || '',
  });

  payment.consumedAt = now;
  payment.business = business._id;
  await payment.save();

  const token = generateToken(owner);

  res.status(201).json({
    success: true,
    token,
    user: owner.toSafeObject(),
    business,
  });
});

// @desc    Login (any role: owner, manager, cashier, inventory_staff)
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact your business owner.');
  }

  const business = await Business.findById(user.business);
  if (!business || !business.isActive) {
    res.status(403);
    throw new Error('This business account is inactive');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: user.toSafeObject(),
    business,
  });
});

// @desc    Get current logged-in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.toSafeObject(),
    business: req.business,
  });
});

// @desc    Change own password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('currentPassword and newPassword are required');
  }
  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { registerBusiness, login, getMe, changePassword };
