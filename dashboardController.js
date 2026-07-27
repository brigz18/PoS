const asyncHandler = require('../utils/asyncHandler');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

// @desc    Aggregate dashboard statistics for the logged-in business
// @route   GET /api/dashboard
// @access  Private
const getDashboardStats = asyncHandler(async (req, res) => {
  const businessId = req.business._id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todaySales, products, customerCount, topProductsAgg] = await Promise.all([
    Sale.find({ business: businessId, createdAt: { $gte: startOfToday }, status: 'completed' }),
    Product.find({ business: businessId }),
    Customer.countDocuments({ business: businessId }),
    Sale.aggregate([
      { $match: { business: businessId, status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayOrders = todaySales.length;
  const todayProfit = todaySales.reduce((sum, s) => {
    const cost = s.items.reduce((c, item) => {
      const product = products.find((p) => p._id.toString() === item.product.toString());
      return c + (product ? product.costPrice * item.quantity : 0);
    }, 0);
    return sum + (s.total - cost - s.tax);
  }, 0);

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock).slice(0, 10);

  res.json({
    success: true,
    data: {
      todayRevenue,
      todayOrders,
      todayProfit,
      totalProducts: products.length,
      totalCustomers: customerCount,
      lowStockCount: products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length,
      outOfStockCount: products.filter((p) => p.stock === 0).length,
      lowStockProducts,
      topProducts: topProductsAgg,
    },
  });
});

module.exports = { getDashboardStats };
