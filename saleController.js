const asyncHandler = require('../utils/asyncHandler');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const InventoryMovement = require('../models/InventoryMovement');

// Loyalty points earned per sale. Not something the frontend sends or
// configures anywhere - this is a simple, standard "1 point per ₱100
// spent" house rule applied server-side whenever a sale is attached to a
// customer. Change PESOS_PER_POINT here if the business wants a different rate.
const PESOS_PER_POINT = 100;

// Short, human-scannable, and collision-safe without needing a running
// counter document: RCT-<base36 timestamp><4 random base36 chars>, e.g.
// "RCT-M1A2B3C4-K9F2".
function generateReceiptNumber() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCT-${time}-${rand}`;
}

// @desc    Create a sale (POS checkout) - deducts stock, logs inventory
//          movements, and updates customer loyalty points/spend.
// @route   POST /api/sales
// @access  Private (requires usePOS permission, or Owner)
const createSale = asyncHandler(async (req, res) => {
  const { items, customerId, paymentMethod, amountReceived, discount } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required to complete a sale');
  }

  // Load every referenced product ONCE, scoped to this business, and use
  // it as the source of truth for price/cost/stock - never trust the
  // price the client sent, since that's just whatever was in the browser's
  // cart state and could be stale or tampered with.
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, business: req.business._id });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const saleItems = [];
  for (const line of items) {
    const product = productMap.get(String(line.productId));
    if (!product) {
      res.status(404);
      throw new Error('One of the items in this sale no longer exists');
    }
    const qty = Number(line.qty) || 0;
    if (qty <= 0) {
      res.status(400);
      throw new Error(`Invalid quantity for ${product.name}`);
    }
    if (product.stock < qty) {
      res.status(400);
      throw new Error(`Not enough stock for ${product.name} (${product.stock} available, ${qty} requested)`);
    }
    saleItems.push({
      product: product._id,
      name: product.name,
      qty,
      price: product.price,
      cost: product.costPrice,
      subtotal: product.price * qty,
    });
  }

  const subtotal = saleItems.reduce((sum, i) => sum + i.subtotal, 0);
  const requestedDiscount = Number(discount) || 0;
  // Never let a discount exceed the subtotal (would produce a negative total).
  const safeDiscount = Math.min(Math.max(requestedDiscount, 0), subtotal);
  const taxable = subtotal - safeDiscount;
  const taxRate = Number(req.business.taxRate) || 0;
  const tax = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  const method = ['cash', 'card', 'gcash', 'maya'].includes(paymentMethod) ? paymentMethod : 'cash';
  const received = amountReceived != null ? Number(amountReceived) : total;
  if (method === 'cash' && received < total) {
    res.status(400);
    throw new Error('Amount received is less than the total due');
  }
  const change = Math.max(0, Math.round((received - total) * 100) / 100);

  let customer = null;
  if (customerId) {
    customer = await Customer.findOne({ _id: customerId, business: req.business._id });
    if (!customer) {
      res.status(404);
      throw new Error('Selected customer not found');
    }
  }

  const sale = await Sale.create({
    business: req.business._id,
    receiptNumber: generateReceiptNumber(),
    items: saleItems,
    customer: customer ? customer._id : null,
    paymentMethod: method,
    subtotal,
    discount: safeDiscount,
    tax,
    total,
    amountReceived: received,
    change,
    cashier: req.user._id,
  });

  // Deduct stock + write one inventory movement per line item.
  await Promise.all(
    saleItems.map(async (line) => {
      await Product.updateOne({ _id: line.product }, { $inc: { stock: -line.qty } });
      await InventoryMovement.create({
        business: req.business._id,
        product: line.product,
        type: 'out',
        quantity: line.qty,
        reference: sale.receiptNumber,
        notes: 'Sale',
        createdBy: req.user._id,
      });
    })
  );

  // Award loyalty points + track lifetime spend.
  if (customer) {
    customer.totalSpent += total;
    customer.points += Math.floor(total / PESOS_PER_POINT);
    await customer.save();
  }

  res.status(201).json({ success: true, data: sale });
});

// @desc    List sales for the logged-in business
// @route   GET /api/sales
// @access  Private (requires viewSalesHistory permission, or Owner)
const getSales = asyncHandler(async (req, res) => {
  const filter = { business: req.business._id };

  // Optional ?from=&to= ISO date filtering, and ?search= on receipt number.
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  if (req.query.search) {
    filter.receiptNumber = new RegExp(req.query.search.trim(), 'i');
  }

  const sales = await Sale.find(filter)
    .sort({ createdAt: -1 })
    .populate('customer', 'name email phone')
    .populate('cashier', 'name');

  res.json({ success: true, count: sales.length, data: sales });
});

// @desc    Get a single sale (receipt detail)
// @route   GET /api/sales/:id
// @access  Private (requires viewSalesHistory permission, or Owner)
const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, business: req.business._id })
    .populate('customer', 'name email phone')
    .populate('cashier', 'name');
  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }
  res.json({ success: true, data: sale });
});

module.exports = { createSale, getSales, getSale };
