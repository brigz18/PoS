const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    sku: { type: String, required: [true, 'SKU is required'], trim: true },
    barcode: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    costPrice: { type: Number, default: 0, min: 0 },
    // NOTE: the frontend (js/app.js: saveProduct/renderProductsTable/POS)
    // reads and writes this as `price`, not `sellingPrice` - keep the field
    // name exactly `price` or every product row in the UI breaks silently
    // (shows ₱0.00 everywhere instead of an error).
    price: { type: Number, required: [true, 'Selling price is required'], min: 0 },
    unit: { type: String, default: 'pc', trim: true },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    // Base64 data URL from the product photo uploader, or '' for no image.
    image: { type: String, default: '' },
  },
  { timestamps: true }
);

productSchema.index({ business: 1, sku: 1 }, { unique: true });
productSchema.index({ business: 1, name: 'text', sku: 'text', barcode: 'text' });

module.exports = mongoose.model('Product', productSchema);
