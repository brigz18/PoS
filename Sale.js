const mongoose = require('mongoose');

// Each item is a snapshot at the time of sale (name/price/cost captured as
// they were then), so editing a product later never rewrites history on
// past receipts or past profit numbers.
const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // unit selling price at time of sale
    cost: { type: Number, required: true, min: 0 }, // unit cost price at time of sale
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    receiptNumber: { type: String, required: true },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'A sale must include at least one item',
      },
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'gcash', 'maya'],
      default: 'cash',
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountReceived: { type: Number, required: true, min: 0 },
    change: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Completed', 'Refunded', 'Cancelled'],
      default: 'Completed',
    },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

saleSchema.index({ business: 1, receiptNumber: 1 }, { unique: true });
saleSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
