const mongoose = require('mongoose');

/**
 * A Business represents a subscribing tenant (the "Owner" account).
 * All other data (users, products, sales, etc.) is scoped to a businessId
 * so that multiple businesses can safely share the same database.
 */
const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, default: 'PHP' },
    currencySymbol: { type: String, default: '\u20B1' },
    taxRate: { type: Number, default: 12 },
    timezone: { type: String, default: 'Asia/Manila' },
    subscriptionPlan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      default: 'starter',
    },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'expired'],
      default: 'trialing',
    },
    // When the current paid period ends. Access is blocked (see
    // middleware/auth.js) once this date is in the past, until the owner
    // renews (see controllers/paymentController.js -> renew).
    subscriptionExpiresAt: { type: Date, default: null },
    // Snapshot of the most recent successful payment, for support/reference.
    lastPaymentReference: { type: String, default: null },
    lastPaymentAt: { type: Date, default: null },
    maxUsers: { type: Number, default: 5 },
    maxBranches: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);
