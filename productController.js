const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');

// The frontend currently always calls Api.products.list() with no query
// string (filtering/searching happens client-side against the full loaded
// catalog), but ?search= and ?category= are supported here too so the
// endpoint is genuinely useful on its own (Postman, a future mobile
// client, etc.) and not just something that happens to work today.
const buildProductFilter = (req) => {
  const filter = { business: req.business._id };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const re = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: re }, { sku: re }, { barcode: re }];
  }
  return filter;
};

// Normalizes a couple of payload quirks so the schema never sees them:
// - an empty string category ("uncategorized" option) becomes `undefined`
//   instead of tripping a CastError on an invalid ObjectId
// - numeric fields sent as strings from <input> elements are coerced
const buildProductPayload = (body) => {
  const payload = {};
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.sku !== undefined) payload.sku = String(body.sku).trim();
  if (body.barcode !== undefined) payload.barcode = String(body.barcode).trim();
  if (body.unit !== undefined) payload.unit = String(body.unit).trim() || 'pc';
  if (body.category !== undefined) payload.category = body.category || undefined;
  if (body.costPrice !== undefined) payload.costPrice = Number(body.costPrice) || 0;
  if (body.price !== undefined) payload.price = Number(body.price) || 0;
  if (body.stock !== undefined) payload.stock = Number(body.stock) || 0;
  if (body.minStock !== undefined) payload.minStock = Number(body.minStock) || 0;
  // Only touch `image` if the key was actually sent (see js/app.js
  // saveProduct: it omits `image` entirely when the photo wasn't touched,
  // so an edit never accidentally wipes an existing photo).
  if (body.image !== undefined) payload.image = body.image;
  return payload;
};

// @desc    List products for the logged-in business
// @route   GET /api/products
// @access  Private (requires manageProducts permission, or Owner)
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find(buildProductFilter(req)).sort({ name: 1 });
  res.json({ success: true, count: products.length, data: products });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private (requires manageProducts permission, or Owner)
const createProduct = asyncHandler(async (req, res) => {
  const payload = buildProductPayload(req.body);
  if (!payload.name || !payload.sku || !payload.price) {
    res.status(400);
    throw new Error('Name, SKU and selling price are required');
  }

  const product = await Product.create({ ...payload, business: req.business._id });
  res.status(201).json({ success: true, data: product });
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (requires manageProducts permission, or Owner)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  Object.assign(product, buildProductPayload(req.body));
  await product.save();
  res.json({ success: true, data: product });
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private (requires manageProducts permission, or Owner)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted successfully' });
});

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };
