const asyncHandler = require('../utils/asyncHandler');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');

const generateSaleNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SL-${timestamp}${random}`;
};

/**
 * IMPORTANT: this checkout flow intentionally does NOT use MongoDB
 * multi-document transactions (session.startTransaction()).
 *
 * Transactions require the database to be a replica set (or mongos for a
 * sharded cluster). A plain local `mongod` - which is what most people get
 * from a default MongoDB Community install on localhost:27017 - runs as a
 * single standalone node and will reject transactions with:
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 * That would make checkout fail 100% of the time on a standalone database.
 *
 * Instead, stock is decremented with atomic, conditional single-document
 * updates (findOneAndUpdate with a `stock >= quantity` guard), which is
 * race-safe on its own without needing a transaction. If any line item in
 * the sale can't be fulfilled, every stock change already made earlier in
 * the same request is rolled back (compensated) before returning an error,
 * so a failed sale never leaves stock partially deducted.
 */

// @desc    Create a new sale (checkout) - deducts stock and logs a stock movement
// @route   POST /api/sales
// @access  Private (owner, manager, cashier)
const createSale = asyncHandler(async (req, res) => {
  const { items, customerId, paymentMethod, amountPaid, discount } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Sale must include at least one item');
  }
  for (const line of items) {
    if (!line.productId || !line.quantity || line.quantity <= 0) {
      res.status(400);
      throw new Error('Each item requires a valid productId and a quantity greater than 0');
    }
  }

  // Merge duplicate productIds in the same request into a single line, so
  // two rows for the same product don't race against each other's guard check.
  const mergedByProduct = new Map();
  for (const line of items) {
    mergedByProduct.set(line.productId, (mergedByProduct.get(line.productId) || 0) + line.quantity);
  }

  const decremented = []; // { productId, quantity } - used to roll back on failure
  const saleItems = [];
  let subtotal = 0;

  const rollbackStock = async () => {
    for (const d of decremented) {
      await Product.updateOne({ _id: d.productId, business: req.business._id }, { $inc: { stock: d.quantity } });
    }
  };

  try {
    for (const [productId, quantity] of mergedByProduct.entries()) {
      // Atomic, race-safe decrement: only succeeds if enough stock is
      // available at the moment of the update, and only for this business.
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, business: req.business._id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        // Either the product doesn't exist/belong to this business, or there
        // wasn't enough stock. Distinguish the two for a clearer error.
        const exists = await Product.exists({ _id: productId, business: req.business._id });
        if (!exists) throw new Error(`Product not found: ${productId}`);
        throw new Error('Insufficient stock for one or more items in the cart');
      }

      decremented.push({ productId, quantity });
      const lineTotal = updatedProduct.sellingPrice * quantity;
      subtotal += lineTotal;
      saleItems.push({ product: updatedProduct._id, name: updatedProduct.name, price: updatedProduct.sellingPrice, quantity });
    }

    const taxRate = req.business.taxRate || 0;
    const tax = +(subtotal * (taxRate / 100)).toFixed(2);
    const discountAmount = discount || 0;
    const total = +(subtotal + tax - discountAmount).toFixed(2);

    if (amountPaid === undefined || amountPaid === null || amountPaid < total) {
      throw new Error('Amount paid is less than the total amount due');
    }

    if (customerId) {
      const customerExists = await Customer.exists({ _id: customerId, business: req.business._id });
      if (!customerExists) throw new Error('Selected customer was not found');
    }

    const saleNumber = generateSaleNumber();

    const sale = await Sale.create({
      business: req.business._id,
      saleNumber,
      items: saleItems,
      customer: customerId || null,
      cashier: req.user._id,
      subtotal,
      tax,
      discount: discountAmount,
      total,
      paymentMethod: paymentMethod || 'cash',
      amountPaid,
      change: +(amountPaid - total).toFixed(2),
    });

    // --- Point of no return: the sale is now persisted and stock has been
    // deducted. Everything below is best-effort bookkeeping - if it fails,
    // we log the problem but still return success, because the sale itself
    // is real and should not be rolled back just because an audit log or a
    // loyalty-points update hiccuped.
    try {
      await StockMovement.insertMany(
        saleItems.map((item) => ({
          business: req.business._id,
          product: item.product,
          type: 'out',
          quantity: item.quantity,
          reference: saleNumber,
          notes: 'Sale',
          createdBy: req.user._id,
        }))
      );
    } catch (movementErr) {
      console.error('Failed to log stock movements for sale', saleNumber, movementErr);
    }

    if (customerId) {
      try {
        await Customer.updateOne(
          { _id: customerId, business: req.business._id },
          { $inc: { totalSpent: total, points: Math.floor(total / 10) } }
        );
      } catch (loyaltyErr) {
        console.error('Failed to update customer loyalty stats for sale', saleNumber, loyaltyErr);
      }
    }

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    await rollbackStock();
    res.status(400);
    throw error;
  }
});

// @desc    List sales (with optional date range filter)
// @route   GET /api/sales
// @access  Private (owner, manager, cashier)
const getSales = asyncHandler(async (req, res) => {
  const { from, to, limit } = req.query;
  const filter = { business: req.business._id };

  // Cashiers only see their own sales; owners/managers see everything
  if (req.user.role === 'cashier') filter.cashier = req.user._id;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const sales = await Sale.find(filter)
    .populate('customer', 'name')
    .populate('cashier', 'name')
    .sort({ createdAt: -1 })
    .limit(limit ? parseInt(limit, 10) : 100);

  res.json({ success: true, count: sales.length, data: sales });
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, business: req.business._id })
    .populate('customer', 'name')
    .populate('cashier', 'name');
  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }
  res.json({ success: true, data: sale });
});

module.exports = { createSale, getSales, getSale };
