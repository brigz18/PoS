const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'piece' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, default: 5 },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  },
  { timestamps: true }
);

productSchema.index({ business: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
