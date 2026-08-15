const mongoose = require('mongoose');

// Represents one simulated payment-processor transaction. A completed
// payment is a "voucher" that registerBusiness() or the renew endpoint
// later consumes exactly once (see `consumedAt`) to actually create a
// business or extend a subscription - this two-step design mirrors how a
// real payment gateway (checkout now, fulfill after a webhook/confirmation)
// would work, without needing a real processor for this project.
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    purpose: {
      type: String,
      enum: ['registration', 'renewal'],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'gcash', 'maya'],
      required: true,
    },
    payerName: { type: String, trim: true, default: '' },
    // Intentionally NOT storing raw card number/CVV, even for this
    // simulated processor - only a masked last-4 for the receipt/audit
    // trail, same discipline a real PCI-scoped integration would require.
    cardLast4: { type: String, default: '' },
    mobileNumber: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    failureReason: { type: String, default: '' },

    // Set once this payment is actually applied to a business (at
    // registration or renewal). A payment can only ever be consumed once.
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
