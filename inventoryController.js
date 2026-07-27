const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

// @desc    Get inventory overview (all products with stock/value info)
// @route   GET /api/inventory
// @access  Private (owner, manager, inventory_staff)
const getInventoryOverview = asyncHandler(async (req, res) => {
  const products = await Product.find({ business: req.business._id }).sort({ name: 1 });
  const totalValue = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  res.json({
    success: true,
    summary: { totalItems: products.length, totalValue, lowStock, outOfStock },
    data: products,
  });
});

// @desc    List stock movements
// @route   GET /api/inventory/movements
// @access  Private (owner, manager, inventory_staff)
const getMovements = asyncHandler(async (req, res) => {
  const movements = await StockMovement.find({ business: req.business._id })
    .populate('product', 'name sku')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, count: movements.length, data: movements });
});

// @desc    Manually adjust stock (stock-in, stock-out, or correction)
// @route   POST /api/inventory/adjust
// @access  Private (owner, manager, inventory_staff)
const adjustStock = asyncHandler(async (req, res) => {
  const { productId, type, quantity, reference, notes } = req.body;

  if (!productId || !type || !quantity) {
    res.status(400);
    throw new Error('productId, type and quantity are required');
  }
  if (!['in', 'out', 'adjustment'].includes(type)) {
    res.status(400);
    throw new Error("type must be one of 'in', 'out', 'adjustment'");
  }

  const product = await Product.findOne({ _id: productId, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (type === 'in') {
    product.stock += Math.abs(quantity);
  } else if (type === 'out') {
    if (product.stock < Math.abs(quantity)) {
      res.status(400);
      throw new Error('Cannot remove more stock than is currently available');
    }
    product.stock -= Math.abs(quantity);
  } else {
    // adjustment: quantity can be positive or negative
    product.stock = Math.max(0, product.stock + quantity);
  }

  await product.save();

  const movement = await StockMovement.create({
    business: req.business._id,
    product: product._id,
    type,
    quantity,
    reference: reference || '',
    notes: notes || '',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: { product, movement } });
});

module.exports = { getInventoryOverview, getMovements, adjustStock };
