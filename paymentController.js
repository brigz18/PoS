const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const Payment = require('../models/Payment');
const Business = require('../models/Business');

// Subscription pricing shown on the landing page, kept in one place so the
// backend is the source of truth for what a plan actually costs (never trust
// a price sent from the browser).
const PLAN_CATALOG = {
  starter: { amount: 29, maxUsers: 5, maxBranches: 1 },
  professional: { amount: 79, maxUsers: 15, maxBranches: 3 },
  enterprise: { amount: 149, maxUsers: 9999, maxBranches: 9999 },
};

const SUBSCRIPTION_DAYS = 30; // all plans bill monthly

function generateReference() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function maskContact(paymentMethod, value) {
  const digits = (value || '').replace(/\D/g, '');
  if (paymentMethod === 'card') {
    return digits.length >= 4 ? `**** **** **** ${digits.slice(-4)}` : '****';
  }
  // gcash / maya - mobile numbers
  return digits.length >= 4 ? `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}` : '****';
}

/**
 * SIMULATED payment processor. See the notice at the top of models/Payment.js
 * for what would need to change to accept real money (PayMongo is the usual
 * choice for GCash + Maya + Cards in one integration for a PH business).
 *
 * This does basic, honest format validation (a real card number needs to be
 * the right length, a PH mobile number needs to look like one, etc.) so the
 * UI isn't lying about a "processing" step - but no processor is contacted
 * and no money moves either way.
 */
function simulateProcessPayment({ paymentMethod, cardNumber, cardExpiry, cardCvv, mobileNumber }) {
  if (paymentMethod === 'card') {
    const digits = (cardNumber || '').replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return { success: false, reason: 'Card number looks invalid' };
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry || '')) {
      return { success: false, reason: 'Card expiry must be in MM/YY format' };
    }
    const [mm, yy] = (cardExpiry || '').split('/').map(Number);
    const expiryDate = new Date(2000 + yy, mm, 0);
    if (mm < 1 || mm > 12 || expiryDate < new Date()) {
      return { success: false, reason: 'Card has expired or has an invalid expiry date' };
    }
    if (!/^\d{3,4}$/.test(cardCvv || '')) {
      return { success: false, reason: 'CVV must be 3 or 4 digits' };
    }
    return { success: true, contact: cardNumber };
  }

  if (paymentMethod === 'gcash' || paymentMethod === 'maya') {
    const digits = (mobileNumber || '').replace(/\D/g, '');
    if (!/^(09\d{9}|639\d{9})$/.test(digits)) {
      return { success: false, reason: 'Enter a valid Philippine mobile number (e.g. 09171234567)' };
    }
    return { success: true, contact: mobileNumber };
  }

  return { success: false, reason: 'Unsupported payment method' };
}

// @desc    Get the current subscription plan catalog (pricing, limits)
// @route   GET /api/payments/plans
// @access  Public
const getPlans = asyncHandler(async (req, res) => {
  res.json({ success: true, data: PLAN_CATALOG });
});

// @desc    Pay for a subscription plan - used both for a brand-new business
//          registration AND for renewing an existing expired/expiring one.
//          Returns a one-time-use payment reference that must be presented
//          to /api/auth/register-business or /api/payments/renew afterward.
// @route   POST /api/payments/checkout
// @access  Public (a brand-new business doesn't have an account yet)
const checkout = asyncHandler(async (req, res) => {
  const { plan, paymentMethod, payerName, cardNumber, cardExpiry, cardCvv, mobileNumber, purpose } = req.body;

  if (!plan || !PLAN_CATALOG[plan]) {
    res.status(400);
    throw new Error('A valid plan (starter, professional, enterprise) is required');
  }
  if (!paymentMethod || !['gcash', 'maya', 'card'].includes(paymentMethod)) {
    res.status(400);
    throw new Error('A valid payment method (gcash, maya, card) is required');
  }
  if (!payerName || !payerName.trim()) {
    res.status(400);
    throw new Error('Payer name is required');
  }

  const result = simulateProcessPayment({ paymentMethod, cardNumber, cardExpiry, cardCvv, mobileNumber });
  const amount = PLAN_CATALOG[plan].amount;
  const reference = generateReference();
  const contactValue = paymentMethod === 'card' ? cardNumber : mobileNumber;

  const payment = await Payment.create({
    reference,
    plan,
    amount,
    paymentMethod,
    payerName: payerName.trim(),
    payerContactMasked: maskContact(paymentMethod, contactValue),
    status: result.success ? 'completed' : 'failed',
    failureReason: result.success ? null : result.reason,
    purpose: purpose === 'renewal' ? 'renewal' : 'registration',
  });

  if (!result.success) {
    res.status(402);
    throw new Error(result.reason || 'Payment could not be processed');
  }

  res.status(201).json({
    success: true,
    data: {
      reference: payment.reference,
      plan: payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      payerContactMasked: payment.payerContactMasked,
    },
  });
});

// @desc    Renew (extend) the logged-in owner's subscription using a payment
//          reference obtained from /api/payments/checkout
// @route   POST /api/payments/renew
// @access  Private (owner only)
const renew = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  if (!reference) {
    res.status(400);
    throw new Error('A payment reference is required');
  }
  if (req.user.role !== 'owner') {
    res.status(403);
    throw new Error('Only the business Owner can renew the subscription');
  }

  const payment = await Payment.findOne({ reference });
  if (!payment) {
    res.status(404);
    throw new Error('Payment reference not found');
  }
  if (payment.status !== 'completed') {
    res.status(400);
    throw new Error('This payment was not completed successfully');
  }
  if (payment.consumedAt) {
    res.status(400);
    throw new Error('This payment reference has already been used');
  }

  const business = await Business.findById(req.business._id);
  const now = new Date();
  // If the current subscription hasn't fully lapsed yet, extend from its
  // existing expiry date rather than from "now" (so renewing early doesn't
  // waste the days a business already paid for).
  const base = business.subscriptionExpiresAt && business.subscriptionExpiresAt > now ? business.subscriptionExpiresAt : now;
  const newExpiry = new Date(base.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  business.subscriptionPlan = payment.plan;
  business.subscriptionStatus = 'active';
  business.subscriptionExpiresAt = newExpiry;
  business.lastPaymentReference = payment.reference;
  business.lastPaymentAt = now;
  business.maxUsers = PLAN_CATALOG[payment.plan].maxUsers;
  business.maxBranches = PLAN_CATALOG[payment.plan].maxBranches;
  await business.save();

  payment.consumedAt = now;
  payment.business = business._id;
  await payment.save();

  res.json({ success: true, data: business });
});

module.exports = { getPlans, checkout, renew, PLAN_CATALOG, SUBSCRIPTION_DAYS };
