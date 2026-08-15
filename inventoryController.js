const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

// @desc    Inventory overview: summary stats + every product's stock status
// @route   GET /api/inventory
// @access  Private (requires manageInventory permission, or Owner)
const getInventoryOverview = asyncHandler(async (req, res) => {
  const products = await Product.find({ business: req.business._id }).sort({ name: 1 });

  const summary = products.reduce(
    (acc, p) => {
      acc.totalItems += 1;
      acc.totalValue += (p.costPrice || 0) * (p.stock || 0);
      if (p.stock === 0) acc.outOfStock += 1;
      else if (p.stock <= p.minStock) acc.lowStock += 1;
      return acc;
    },
    { totalItems: 0, totalValue: 0, lowStock: 0, outOfStock: 0 }
  );

  res.json({ success: true, summary, data: products });
});

// @desc    Recent inventory movement ledger (stock in/out/adjustments)
// @route   GET /api/inventory/movements
// @access  Private (requires manageInventory permission, or Owner)
const getMovements = asyncHandler(async (req, res) => {
  const movements = await InventoryMovement.find({ business: req.business._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('product', 'name')
    .populate('createdBy', 'name');

  res.json({ success: true, count: movements.length, data: movements });
});

// A manual adjustment's *reason* is one of 4 categories, but the stock
// change direction only really has two states in this app's UI (there's no
// +/- toggle next to Quantity - just a positive number and a reason). We
// treat "Stock In" as the only increasing reason; "Stock Out" and
// "Correction" both decrease (a correction here almost always means
// "we counted less than the system thinks" - shrinkage/breakage/loss),
// and "transfer" (not currently exposed in the UI, reserved for a future
// multi-branch feature) also decreases, mirroring stock leaving this branch.
const STOCK_DIRECTION = { in: 1, out: -1, adjustment: -1, transfer: -1 };

// @desc    Apply a manual stock adjustment and log it to the movement ledger
// @route   POST /api/inventory/adjust
// @access  Private (requires manageInventory permission, or Owner)
const adjustStock = asyncHandler(async (req, res) => {
  const { productId, type, quantity, reference, notes } = req.body;

  if (!STOCK_DIRECTION[type]) {
    res.status(400);
    throw new Error('Invalid adjustment type');
  }
  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    res.status(400);
    throw new Error('Enter a valid quantity');
  }

  const product = await Product.findOne({ _id: productId, business: req.business._id });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const delta = qty * STOCK_DIRECTION[type];
  if (product.stock + delta < 0) {
    res.status(400);
    throw new Error(`This would take ${product.name}'s stock below zero (currently ${product.stock})`);
  }

  product.stock += delta;
  await product.save();

  const movement = await InventoryMovement.create({
    business: req.business._id,
    product: product._id,
    type,
    quantity: qty,
    reference: (reference || '').trim(),
    notes: (notes || '').trim(),
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: { product, movement } });
});

module.exports = { getInventoryOverview, getMovements, adjustStock };
