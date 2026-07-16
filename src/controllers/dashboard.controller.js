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

// ---- internal data getters (reused by both the individual endpoints and the combined /dashboard endpoint) ----

async function getSummary() {
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const [todaySalesAgg, todayOrders, totalProducts, totalCustomers, lowStock] =
    await Promise.all([
      Cart.aggregate([
        { $match: { status: "completed", createdAt: today } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),
      Cart.countDocuments({ status: "completed", createdAt: today }),
      Product.countDocuments({ status: "active" }),
      Customer.countDocuments({ createdAt: today }),
      Product.countDocuments({
        $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
      }),
    ]);

  return {
    today_sales: todaySalesAgg[0]?.total || 0,
    today_orders: todayOrders,
    products: totalProducts,
    customers: totalCustomers,
    low_stock: lowStock,
  };
}

async function getSalesChart(days = 7) {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  return Cart.aggregate([
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
}

async function getRecentOrders(limit = 10) {
  return Cart.find({ status: "completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("customer", "name mobile")
    .select(
      "invoiceNo grandTotal paymentMethod paymentStatus customer createdAt",
    );
}

async function getTopProducts(limit = 5) {
  return Cart.aggregate([
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
}

async function getLowStock() {
  return Product.find({
    $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
    status: "active",
  })
    .populate("category", "name")
    .sort({ stockQty: 1 });
}

async function getNotifications(userId, limit = 10) {
  return Notification.find({ $or: [{ forUser: null }, { forUser: userId }] })
    .sort({ createdAt: -1 })
    .limit(limit);
}

// ---- individual endpoints (kept for backward compatibility) ----

// GET /dashboard/summary
exports.summary = asyncHandler(async (req, res) => {
  return success(res, "Dashboard Summary Cards", await getSummary());
});

// GET /dashboard/sales-chart
exports.salesChart = asyncHandler(async (req, res) => {
  const chart = await getSalesChart(Number(req.query.days || 7));
  return success(res, "Daily Sales Chart", { chart });
});

// GET /dashboard/recent-orders
exports.recentOrders = asyncHandler(async (req, res) => {
  const orders = await getRecentOrders(Number(req.query.limit || 10));
  return success(res, "Recent Orders", { orders });
});

// GET /dashboard/top-products
exports.topProducts = asyncHandler(async (req, res) => {
  const products = await getTopProducts(Number(req.query.limit || 5));
  return success(res, "Top Selling Products", { products });
});

// GET /dashboard/low-stock
exports.lowStock = asyncHandler(async (req, res) => {
  const products = await getLowStock();
  return success(res, "Low Stock Products", { products });
});

// GET /dashboard/notifications
exports.notifications = asyncHandler(async (req, res) => {
  const notifications = await getNotifications(
    req.user._id,
    Number(req.query.limit || 10),
  );
  return success(res, "Dashboard Notifications", { notifications });
});

// ---- combined endpoint: everything in one call, each as its own array/object ----

// GET /dashboard
exports.all = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 7);
  const ordersLimit = Number(req.query.ordersLimit || 10);
  const productsLimit = Number(req.query.productsLimit || 5);
  const notificationsLimit = Number(req.query.notificationsLimit || 10);

  const [
    summary,
    salesChart,
    recentOrders,
    topProducts,
    lowStock,
    notifications,
  ] = await Promise.all([
    getSummary(),
    getSalesChart(days),
    getRecentOrders(ordersLimit),
    getTopProducts(productsLimit),
    getLowStock(),
    getNotifications(req.user._id, notificationsLimit),
  ]);

  return success(res, "Dashboard data", {
    summary,
    salesChart,
    recentOrders,
    topProducts,
    lowStock,
    notifications,
  });
});
