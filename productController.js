const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');

const getProducts = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const filter = { business: req.business._id };
  if (category && category !== 'all') filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  const products = await Product.find(filter).populate('category', 'name color').sort({ name: 1 });
  res.json({ success: true, count: products.length, data: products });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, business: req.business._id }).populate('category');
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, barcode, category, costPrice, sellingPrice, unit, stock, minStock, image, supplier } = req.body;
  if (!name || !sku || sellingPrice === undefined) {
    res.status(400);
    throw new Error('name, sku and sellingPrice are required');
  }
  const product = await Product.create({
    business: req.business._id,
    name, sku, barcode, category, costPrice, sellingPrice, unit, stock, minStock, image, supplier,
  });
  res.status(201).json({ success: true, data: product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Whitelist updatable fields only - never let a client mass-assign fields
  // like `business` or `_id` via req.body (Object.assign(doc, req.body) would
  // otherwise let a request silently reassign a product to another business).
  const editable = ['name', 'sku', 'barcode', 'category', 'costPrice', 'sellingPrice', 'unit', 'stock', 'minStock', 'image', 'supplier', 'isActive'];
  for (const field of editable) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }

  await product.save();
  res.json({ success: true, data: product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
