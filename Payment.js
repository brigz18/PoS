const mongoose = require('mongoose');

/**
 * Records every subscription payment attempt - both the initial payment made
 * during business registration (before a Business/User even exists yet) and
 * later renewal payments made by an existing Owner.
 *
 * IMPORTANT - READ THIS BEFORE GOING TO PRODUCTION:
 * This project does NOT integrate with a real payment processor. There is no
 * live connection to GCash, Maya, or a card network here - `processPayment()`
 * in controllers/paymentController.js simulates a processor's response using
 * basic format validation only. No real money moves, and no real payment
 * provider is contacted.
 *
 * To accept real payments in the Philippines for GCash, Maya, and Cards
 * through a single integration, the standard option is PayMongo
 * (https://www.paymongo.com) - create a PayMongo account, get your API keys,
 * and swap the body of processPayment() for a real call to PayMongo's
 * Payment Intents / Sources API. Everything else in this file (the record-
 * keeping, the "reference used to unlock registration/renewal" pattern) stays
 * the same - only the actual charge needs to be replaced.
 */
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },

    // What was purchased
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    billingCycle: { type: String, enum: ['monthly'], default: 'monthly' },

    // How it was (simulated to be) paid
    paymentMethod: { type: String, enum: ['gcash', 'maya', 'card'], required: true },
    payerName: { type: String, required: true },
    // Never store full card numbers or full mobile wallet numbers - only a
    // masked/last-4 form, purely for the receipt/support reference.
    payerContactMasked: { type: String, required: true },

    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    failureReason: { type: String, default: null },

    purpose: { type: String, enum: ['registration', 'renewal'], required: true },

    // Set once this payment has actually been used to unlock a business
    // (either creating it at registration, or extending it on renewal).
    // A payment reference can only ever be consumed once.
    consumedAt: { type: Date, default: null },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
