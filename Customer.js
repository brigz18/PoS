const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: { type: String, required: [true, 'Customer name is required'], trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    membership: {
      type: String,
      enum: ['silver', 'gold', 'platinum'],
      default: 'silver',
    },
    // Loyalty points and lifetime spend are earned automatically at
    // checkout (see saleController) - not directly editable from the
    // Add/Edit Customer form.
    points: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
