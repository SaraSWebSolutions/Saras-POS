const Cart = require("../models/Cart");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { generatePdfReport, generateExcelReport } = require("../utils/exporter");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function dateRangeFilter(req, field = "createdAt") {
  const { from, to } = req.query;
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = startOfDay(new Date(from));
  if (to) range.$lte = endOfDay(new Date(to));
  return { [field]: range };
}

// GET /reports/dashboard
exports.dashboardReport = asyncHandler(async (req, res) => {
  const today = { createdAt: { $gte: startOfDay(), $lte: endOfDay() } };
  const [salesAgg, orders] = await Promise.all([
    Cart.aggregate([
      { $match: { status: "completed", ...today } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Cart.countDocuments({ status: "completed", ...today }),
  ]);
  return success(res, "Dashboard report summary", {
    todaySales: salesAgg[0]?.total || 0,
    todayOrders: orders,
  });
});

// GET /reports/today-sales
exports.todaySales = asyncHandler(async (req, res) => {
  const invoices = await Cart.find({
    status: "completed",
    createdAt: { $gte: startOfDay(), $lte: endOfDay() },
  }).populate("customer", "name mobile");
  const total = invoices.reduce((sum, i) => sum + i.grandTotal, 0);
  return success(res, "Today's sales report", {
    invoices,
    total,
    count: invoices.length,
  });
});

// GET /reports/daily
exports.dailyReport = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const rows = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$grandTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return success(res, "Daily sales report", { report: rows });
});

// GET /reports/monthly
exports.monthlyReport = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const rows = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        totalSales: { $sum: "$grandTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return success(res, "Monthly sales report", { report: rows });
});

// GET /reports/product-wise
exports.productWise = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const rows = await Cart.aggregate([
    { $match: filter },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        qtySold: { $sum: "$items.qty" },
        totalSales: { $sum: "$items.total" },
      },
    },
    { $sort: { totalSales: -1 } },
  ]);
  return success(res, "Product-wise sales report", { report: rows });
});

// GET /reports/customer-wise
exports.customerWise = asyncHandler(async (req, res) => {
  const filter = {
    status: "completed",
    customer: { $ne: null },
    ...dateRangeFilter(req),
  };
  const rows = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$customer",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$grandTotal" },
      },
    },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        name: "$customer.name",
        mobile: "$customer.mobile",
        totalOrders: 1,
        totalSpent: 1,
      },
    },
    { $sort: { totalSpent: -1 } },
  ]);
  return success(res, "Customer-wise sales report", { report: rows });
});

// GET /reports/gst
exports.gstReport = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const agg = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalGst: { $sum: "$gstAmount" },
        totalSales: { $sum: "$grandTotal" },
      },
    },
  ]);
  return success(res, "GST summary report", {
    totalGst: agg[0]?.totalGst || 0,
    totalSales: agg[0]?.totalSales || 0,
  });
});

// GET /reports/payment
exports.paymentReport = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const rows = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$paymentMethod",
        total: { $sum: "$grandTotal" },
        count: { $sum: 1 },
      },
    },
  ]);
  return success(res, "Payment method report", { report: rows });
});

// GET /reports/top-selling
exports.topSelling = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const rows = await Cart.aggregate([
    { $match: filter },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        qtySold: { $sum: "$items.qty" },
      },
    },
    { $sort: { qtySold: -1 } },
    { $limit: limit },
  ]);
  return success(res, "Top selling products", { report: rows });
});

// GET /reports/low-stock
exports.lowStockReport = asyncHandler(async (req, res) => {
  const products = await Product.find({
    $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
  }).populate("category", "name");
  return success(res, "Low stock report", { products });
});

// GET /reports/sales-summary
exports.salesSummary = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const agg = await Cart.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$grandTotal" },
        totalOrders: { $sum: 1 },
        totalDiscount: { $sum: "$discountAmount" },
        totalGst: { $sum: "$gstAmount" },
      },
    },
  ]);
  return success(
    res,
    "Sales summary",
    agg[0] || { totalSales: 0, totalOrders: 0, totalDiscount: 0, totalGst: 0 },
  );
});

// GET /reports/profit-loss
exports.profitLoss = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const invoices = await Cart.find(filter).populate(
    "items.product",
    "purchasePrice",
  );

  let revenue = 0;
  let cost = 0;
  invoices.forEach((inv) => {
    revenue += inv.grandTotal;
    inv.items.forEach((item) => {
      const purchasePrice = item.product?.purchasePrice || 0;
      cost += purchasePrice * item.qty;
    });
  });

  return success(res, "Profit & Loss report", {
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    profit: Math.round((revenue - cost) * 100) / 100,
  });
});

// GET /reports/invoices
exports.invoicesReport = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const [invoices, total] = await Promise.all([
    Cart.find(filter)
      .populate("customer", "name mobile")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Cart.countDocuments(filter),
  ]);
  return success(res, "Invoice report", {
    invoices,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /reports/cancelled-bills
exports.cancelledBills = asyncHandler(async (req, res) => {
  const filter = { status: "cancelled", ...dateRangeFilter(req) };
  const bills = await Cart.find(filter).sort({ createdAt: -1 });
  return success(res, "Cancelled bills report", { bills });
});

// GET /reports/hold-bills
exports.holdBills = asyncHandler(async (req, res) => {
  const bills = await Cart.find({ status: "hold" }).sort({ createdAt: -1 });
  return success(res, "Hold bills report", { bills });
});

// GET /reports/export/pdf
exports.exportPdf = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const invoices = await Cart.find(filter)
    .populate("customer", "name mobile")
    .lean();
  const rows = invoices.map((i) => ({
    invoiceNo: i.invoiceNo,
    customer: i.customer?.name || "Walk-in",
    paymentMethod: i.paymentMethod,
    grandTotal: i.grandTotal,
    date: new Date(i.createdAt).toLocaleDateString(),
  }));
  const file = await generatePdfReport(req, {
    title: "Sales Report",
    columns: [
      { key: "invoiceNo", label: "Invoice No", width: 100 },
      { key: "customer", label: "Customer", width: 140 },
      { key: "paymentMethod", label: "Payment", width: 90 },
      { key: "grandTotal", label: "Total", width: 80 },
      { key: "date", label: "Date", width: 100 },
    ],
    rows,
    filenamePrefix: "sales-report",
  });
  return success(res, "Export report as PDF", file);
});

// GET /reports/export/excel
exports.exportExcel = asyncHandler(async (req, res) => {
  const filter = { status: "completed", ...dateRangeFilter(req) };
  const invoices = await Cart.find(filter)
    .populate("customer", "name mobile")
    .lean();
  const rows = invoices.map((i) => ({
    invoiceNo: i.invoiceNo,
    customer: i.customer?.name || "Walk-in",
    paymentMethod: i.paymentMethod,
    grandTotal: i.grandTotal,
    date: new Date(i.createdAt).toLocaleDateString(),
  }));
  const file = await generateExcelReport(req, {
    title: "Sales Report",
    columns: [
      { key: "invoiceNo", header: "Invoice No", width: 18 },
      { key: "customer", header: "Customer", width: 22 },
      { key: "paymentMethod", header: "Payment", width: 15 },
      { key: "grandTotal", header: "Total", width: 12 },
      { key: "date", header: "Date", width: 15 },
    ],
    rows,
    filenamePrefix: "sales-report",
  });
  return success(res, "Export report as Excel", file);
});

// GET /reports/chart/daily
exports.chartDaily = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 30);
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const rows = await Cart.aggregate([
    { $match: { status: "completed", createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$grandTotal" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return success(res, "Daily sales chart data", { chart: rows });
});

// GET /reports/chart/monthly
exports.chartMonthly = asyncHandler(async (req, res) => {
  const months = Number(req.query.months || 12);
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const rows = await Cart.aggregate([
    { $match: { status: "completed", createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        total: { $sum: "$grandTotal" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return success(res, "Monthly sales chart data", { chart: rows });
});

// GET /reports/chart/top-products
exports.chartTopProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 5);
  const rows = await Cart.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        qtySold: { $sum: "$items.qty" },
      },
    },
    { $sort: { qtySold: -1 } },
    { $limit: limit },
  ]);
  return success(res, "Top products chart data", { chart: rows });
});
