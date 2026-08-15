const asyncHandler = require('../utils/asyncHandler');
const Payment = require('../models/Payment');
const Business = require('../models/Business');

// Single source of truth for plan pricing/limits - shared with
// authController's registerBusiness (imports PLAN_CATALOG/SUBSCRIPTION_DAYS
// from this file) so a plan's price/limits only ever need to change here.
// Mirrors the pricing cards on index.html exactly (Starter $29/5 users/1
// branch, Professional $79/15 users/3 branches, Enterprise $149/unlimited).
const PLAN_CATALOG = {
  starter: { label: 'Starter', price: 29, maxUsers: 5, maxBranches: 1 },
  professional: { label: 'Professional', price: 79, maxUsers: 15, maxBranches: 3 },
  enterprise: { label: 'Enterprise', price: 149, maxUsers: 9999, maxBranches: 9999 },
};

// How many days one payment (registration or renewal) buys.
const SUBSCRIPTION_DAYS = 30;

function generatePaymentReference() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PAY-${time}-${rand}`;
}

// @desc    List available subscription plans
// @route   GET /api/payments/plans
// @access  Public
const getPlans = asyncHandler(async (req, res) => {
  const data = Object.entries(PLAN_CATALOG).map(([key, plan]) => ({ key, ...plan }));
  res.json({ success: true, data });
});

// @desc    Simulate a payment-processor checkout. Does NOT create or renew
//          a business by itself - it only produces a `completed` Payment
//          record with a reference, which registerBusiness() or renew()
//          below then consumes exactly once. This mirrors a real payment
//          gateway's "authorize now, fulfill after confirmation" flow.
// @route   POST /api/payments/checkout
// @access  Public (used both by brand-new sign-ups with no account yet, and
//          by the in-app renewal modal, which is authenticated on the
//          frontend but calls this specific step without a token - see
//          js/api.js: Api.payments.checkout always sends auth:false)
const checkout = asyncHandler(async (req, res) => {
  const { plan, paymentMethod, payerName, purpose, cardNumber, cardExpiry, cardCvv, mobileNumber } = req.body;

  if (!PLAN_CATALOG[plan]) {
    res.status(400);
    throw new Error('Invalid plan selected');
  }
  if (!['registration', 'renewal'].includes(purpose)) {
    res.status(400);
    throw new Error('Invalid payment purpose');
  }
  if (!['cash', 'card', 'gcash', 'maya'].includes(paymentMethod)) {
    res.status(400);
    throw new Error('Invalid payment method');
  }
  if (!payerName || !payerName.trim()) {
    res.status(400);
    throw new Error('Payer name is required');
  }

  const paymentDoc = {
    reference: generatePaymentReference(),
    plan,
    amount: PLAN_CATALOG[plan].price,
    purpose,
    paymentMethod,
    payerName: payerName.trim(),
    status: 'completed',
  };

  if (paymentMethod === 'card') {
    const digits = (cardNumber || '').replace(/\D/g, '');
    if (digits.length < 12) {
      res.status(400);
      throw new Error('Enter a valid card number');
    }
    if (!cardExpiry || !cardCvv) {
      res.status(400);
      throw new Error('Card expiry and CVV are required');
    }
    // Simulated processor: never persist the full card number or CVV -
    // only a masked last 4 digits, for the receipt/audit trail.
    paymentDoc.cardLast4 = digits.slice(-4);
  } else {
    if (!mobileNumber || !mobileNumber.trim()) {
      res.status(400);
      throw new Error('Mobile number is required for this payment method');
    }
    paymentDoc.mobileNumber = mobileNumber.trim();
  }

  const payment = await Payment.create(paymentDoc);

  res.status(201).json({
    success: true,
    data: {
      reference: payment.reference,
      plan: payment.plan,
      amount: payment.amount,
      purpose: payment.purpose,
    },
  });
});

// @desc    Consume a completed, unused payment reference to extend the
//          logged-in business's subscription by SUBSCRIPTION_DAYS - on top
//          of any time already remaining, not just from today, so renewing
//          early never costs the business anything.
// @route   POST /api/payments/renew
// @access  Private - Owner only
const renew = asyncHandler(async (req, res) => {
  if (req.user.role !== 'owner') {
    res.status(403);
    throw new Error('Only the business owner can renew the subscription');
  }

  const { reference } = req.body;
  if (!reference) {
    res.status(400);
    throw new Error('Payment reference is required');
  }

  const payment = await Payment.findOne({ reference });
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
    throw new Error('This payment reference has already been used');
  }

  const business = await Business.findById(req.business._id);
  const planLimits = PLAN_CATALOG[payment.plan] || PLAN_CATALOG[business.subscriptionPlan];

  const now = new Date();
  // Extend from "now" unless there's still time left on the current
  // subscription, in which case extend from the existing expiry date.
  const currentExpiry = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : now;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(base.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  business.subscriptionPlan = payment.plan;
  business.subscriptionStatus = 'active';
  business.subscriptionExpiresAt = newExpiry;
  business.maxUsers = planLimits.maxUsers;
  business.maxBranches = planLimits.maxBranches;
  business.lastPaymentReference = payment.reference;
  business.lastPaymentAt = now;
  await business.save();

  payment.consumedAt = now;
  payment.business = business._id;
  await payment.save();

  res.json({ success: true, data: business });
});

module.exports = { PLAN_CATALOG, SUBSCRIPTION_DAYS, getPlans, checkout, renew };
