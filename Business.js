const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currencySymbol: { type: String, default: '\u20B1', trim: true }, // ₱
    taxRate: { type: Number, default: 0, min: 0, max: 100 },

    subscriptionPlan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      default: 'starter',
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expired'],
      default: 'active',
    },
    subscriptionExpiresAt: { type: Date },
    lastPaymentReference: { type: String },
    lastPaymentAt: { type: Date },

    // Plan limits, copied from PLAN_CATALOG at registration/renewal time so
    // they stay pinned to whatever plan the business actually paid for.
    maxUsers: { type: Number, default: 3 },
    maxBranches: { type: Number, default: 1 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);
