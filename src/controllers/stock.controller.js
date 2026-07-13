const Product = require("../models/Product");
const StockHistory = require("../models/StockHistory");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { nextStockRefNumber } = require("../utils/sequence");
const { generatePdfReport, generateExcelReport } = require("../utils/exporter");

// GET /stock/current
exports.current = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const [products, total] = await Promise.all([
    Product.find()
      .populate("category", "name")
      .select("name barcode stockQty lowStockThreshold unit category")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Product.countDocuments(),
  ]);
  return success(res, "Current stock list", {
    products,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// POST /stock/in
exports.stockIn = asyncHandler(async (req, res) => {
  const { product_id, qty, reason } = req.body;
  if (!product_id || !qty || qty <= 0)
    throw new ApiError(422, "product_id and positive qty are required.");

  const product = await Product.findById(product_id);
  if (!product) throw new ApiError(404, "Product not found.");

  const previousStock = product.stockQty;
  product.stockQty += Number(qty);
  await product.save();

  const refNo = await nextStockRefNumber("in");
  const history = await StockHistory.create({
    refNo,
    product: product._id,
    type: "in",
    qty: Number(qty),
    previousStock,
    newStock: product.stockQty,
    reason: reason || "Stock In",
    createdBy: req.user._id,
  });

  return success(res, "Stock In", { history, product }, 201);
});

// POST /stock/out
exports.stockOut = asyncHandler(async (req, res) => {
  const { product_id, qty, reason } = req.body;
  if (!product_id || !qty || qty <= 0)
    throw new ApiError(422, "product_id and positive qty are required.");

  const product = await Product.findById(product_id);
  if (!product) throw new ApiError(404, "Product not found.");
  if (product.stockQty < qty)
    throw new ApiError(422, "Insufficient stock available.");

  const previousStock = product.stockQty;
  product.stockQty -= Number(qty);
  await product.save();

  const refNo = await nextStockRefNumber("out");
  const history = await StockHistory.create({
    refNo,
    product: product._id,
    type: "out",
    qty: Number(qty),
    previousStock,
    newStock: product.stockQty,
    reason: reason || "Stock Out",
    createdBy: req.user._id,
  });

  return success(res, "Stock Out", { history, product }, 201);
});

// GET /stock/history
exports.history = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const filter = type ? { type } : {};
  const [history, total] = await Promise.all([
    StockHistory.find(filter)
      .populate("product", "name barcode")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    StockHistory.countDocuments(filter),
  ]);
  return success(res, "Stock history", {
    history,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /stock/low
exports.low = asyncHandler(async (req, res) => {
  const products = await Product.find({
    $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
  });
  return success(res, "Low stock products", { products });
});

// GET /stock/product/:id
exports.byProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");
  return success(res, "Product stock details", { product });
});

// POST /stock/adjustment
exports.adjustment = asyncHandler(async (req, res) => {
  const { product_id, new_qty, reason } = req.body;
  if (!product_id || new_qty === undefined)
    throw new ApiError(422, "product_id and new_qty are required.");

  const product = await Product.findById(product_id);
  if (!product) throw new ApiError(404, "Product not found.");

  const previousStock = product.stockQty;
  product.stockQty = Number(new_qty);
  await product.save();

  const refNo = await nextStockRefNumber("adjustment");
  const history = await StockHistory.create({
    refNo,
    product: product._id,
    type: "adjustment",
    qty: Number(new_qty) - previousStock,
    previousStock,
    newStock: product.stockQty,
    reason: reason || "Manual stock adjustment",
    createdBy: req.user._id,
  });

  return success(res, "Manual stock adjustment", { history, product });
});

// GET /stock/search
exports.search = asyncHandler(async (req, res) => {
  const { keyword = "" } = req.query;
  const products = await Product.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { barcode: { $regex: keyword, $options: "i" } },
    ],
  });
  return success(res, "Search stock", { products });
});

// GET /stock/category/:id
exports.byCategory = asyncHandler(async (req, res) => {
  const products = await Product.find({ category: req.params.id });
  return success(res, "Stock by category", { products });
});

// GET /stock/export/pdf
exports.exportPdf = asyncHandler(async (req, res) => {
  const products = await Product.find().populate("category", "name").lean();
  const rows = products.map((p) => ({
    name: p.name,
    barcode: p.barcode,
    category: p.category?.name || "",
    stockQty: p.stockQty,
    unit: p.unit,
  }));
  const file = await generatePdfReport(req, {
    title: "Current Stock Report",
    columns: [
      { key: "name", label: "Product", width: 180 },
      { key: "barcode", label: "Barcode", width: 120 },
      { key: "category", label: "Category", width: 120 },
      { key: "stockQty", label: "Stock Qty", width: 80 },
      { key: "unit", label: "Unit", width: 60 },
    ],
    rows,
    filenamePrefix: "stock",
  });
  return success(res, "Export stock PDF", file);
});

// GET /stock/export/excel
exports.exportExcel = asyncHandler(async (req, res) => {
  const products = await Product.find().populate("category", "name").lean();
  const rows = products.map((p) => ({
    name: p.name,
    barcode: p.barcode,
    category: p.category?.name || "",
    stockQty: p.stockQty,
    unit: p.unit,
  }));
  const file = await generateExcelReport(req, {
    title: "Stock Report",
    columns: [
      { key: "name", header: "Product", width: 30 },
      { key: "barcode", header: "Barcode", width: 20 },
      { key: "category", header: "Category", width: 20 },
      { key: "stockQty", header: "Stock Qty", width: 12 },
      { key: "unit", header: "Unit", width: 10 },
    ],
    rows,
    filenamePrefix: "stock",
  });
  return success(res, "Export stock Excel", file);
});

// GET /stock/in/:id
exports.stockInDetails = asyncHandler(async (req, res) => {
  const history = await StockHistory.findOne({
    _id: req.params.id,
    type: "in",
  }).populate("product", "name barcode");
  if (!history) throw new ApiError(404, "Stock-in record not found.");
  return success(res, "Stock In details", { history });
});

// GET /stock/out/:id
exports.stockOutDetails = asyncHandler(async (req, res) => {
  const history = await StockHistory.findOne({
    _id: req.params.id,
    type: "out",
  }).populate("product", "name barcode");
  if (!history) throw new ApiError(404, "Stock-out record not found.");
  return success(res, "Stock Out details", { history });
});

// GET /stock/history/:id  (product stock history)
exports.productHistory = asyncHandler(async (req, res) => {
  const history = await StockHistory.find({ product: req.params.id }).sort({
    createdAt: -1,
  });
  return success(res, "Product stock history", { history });
});

// GET /stock/dashboard
exports.dashboard = asyncHandler(async (req, res) => {
  const [totalProducts, totalStockQtyAgg, lowStockCount, outOfStockCount] =
    await Promise.all([
      Product.countDocuments(),
      Product.aggregate([
        { $group: { _id: null, totalQty: { $sum: "$stockQty" } } },
      ]),
      Product.countDocuments({
        $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
      }),
      Product.countDocuments({ stockQty: 0 }),
    ]);
  return success(res, "Stock summary", {
    totalProducts,
    totalStockQty: totalStockQtyAgg[0]?.totalQty || 0,
    lowStockCount,
    outOfStockCount,
  });
});
