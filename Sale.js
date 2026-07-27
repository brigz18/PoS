const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    saleNumber: { type: String, required: true },
    items: { type: [saleItemSchema], required: true, validate: (v) => v.length > 0 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'gcash', 'maya'], default: 'cash' },
    amountPaid: { type: Number, required: true },
    change: { type: Number, required: true },
    status: { type: String, enum: ['completed', 'voided', 'refunded'], default: 'completed' },
  },
  { timestamps: true }
);

saleSchema.index({ business: 1, saleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Sale', saleSchema);
