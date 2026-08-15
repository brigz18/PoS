const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const Sale = require('../models/Sale');

// Not currently called by js/app.js (the Dashboard page computes its stat
// cards client-side from Api.products.list()/Api.sales.list() so it can
// reuse State.products/State.sales it's already loaded), but is
// implemented as a real, useful endpoint in its own right - e.g. for a
// future mobile widget or an external integration that just wants a
// single summary call instead of pulling every product and every sale.
// @desc    Aggregate dashboard stats for the logged-in business
// @route   GET /api/dashboard
// @access  Private (requires viewDashboard permission, or Owner)
const getDashboardStats = asyncHandler(async (req, res) => {
  const businessId = req.business._id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [products, todaySales, weekSales] = await Promise.all([
    Product.find({ business: businessId }),
    Sale.find({ business: businessId, createdAt: { $gte: startOfToday } }),
    Sale.find({ business: businessId, createdAt: { $gte: sevenDaysAgo } }).sort({ createdAt: 1 }),
  ]);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayOrders = todaySales.length;
  const todayProfit = todaySales.reduce(
    (sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.price - i.cost) * i.qty, 0),
    0
  );
  const margin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outOfStock = products.filter((p) => p.stock <= 0);

  // Bucket the last 7 days (including today) for a simple sales-by-day chart.
  const dayBuckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    dayBuckets.push({ date: d.toISOString().slice(0, 10), total: 0 });
  }
  weekSales.forEach((s) => {
    const key = new Date(s.createdAt).toISOString().slice(0, 10);
    const bucket = dayBuckets.find((b) => b.date === key);
    if (bucket) bucket.total += s.total;
  });

  res.json({
    success: true,
    data: {
      todayRevenue,
      todayOrders,
      todayProfit,
      todayMarginPercent: Math.round(margin * 10) / 10,
      totalProducts: products.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      salesLast7Days: dayBuckets,
    },
  });
});

module.exports = { getDashboardStats };
