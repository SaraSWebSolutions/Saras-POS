const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// GET /dashboard/summary
exports.summary = asyncHandler(async (req, res) => {
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const [todaySalesAgg, todayOrders, totalProducts, totalCustomers, lowStock] = await Promise.all([
    Cart.aggregate([
      { $match: { status: "completed", createdAt: today } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Cart.countDocuments({ status: "completed", createdAt: today }),
    Product.countDocuments({ status: "active" }),
    Customer.countDocuments({ createdAt: today }),
    Product.countDocuments({ $expr: { $lte: ["$stockQty", "$lowStockThreshold"] } }),
  ]);

  return success(res, "Dashboard Summary Cards", {
    today_sales: todaySalesAgg[0]?.total || 0,
    today_orders: todayOrders,
    products: totalProducts,
    customers: totalCustomers,
    low_stock: lowStock,
  });
});

// GET /dashboard/sales-chart
exports.salesChart = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 7);
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const rows = await Cart.aggregate([
    { $match: { status: "completed", createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$grandTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return success(res, "Daily Sales Chart", { chart: rows });
});

// GET /dashboard/recent-orders
exports.recentOrders = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const orders = await Cart.find({ status: "completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("customer", "name mobile")
    .select("invoiceNo grandTotal paymentMethod paymentStatus customer createdAt");

  return success(res, "Recent Orders", { orders });
});

// GET /dashboard/top-products
exports.topProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 5);

  const rows = await Cart.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        totalQty: { $sum: "$items.qty" },
        totalSales: { $sum: "$items.total" },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: limit },
  ]);

  return success(res, "Top Selling Products", { products: rows });
});

// GET /dashboard/low-stock
exports.lowStock = asyncHandler(async (req, res) => {
  const products = await Product.find({
    $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
    status: "active",
  })
    .populate("category", "name")
    .sort({ stockQty: 1 });

  return success(res, "Low Stock Products", { products });
});

// GET /dashboard/notifications
exports.notifications = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const notifications = await Notification.find({
    $or: [{ forUser: null }, { forUser: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  return success(res, "Dashboard Notifications", { notifications });
});
