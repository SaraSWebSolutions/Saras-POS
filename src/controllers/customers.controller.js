const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const Customer = require("../models/Customer");
const Cart = require("../models/Cart");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");

// GET /customers
exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query;
  const filter = search
    ? { $or: [{ name: { $regex: search, $options: "i" } }, { mobile: { $regex: search, $options: "i" } }] }
    : {};

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Customer.countDocuments(filter),
  ]);

  return success(res, "Get customer list", {
    customers,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /customers/:id
exports.getOne = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found.");
  return success(res, "Get customer details", { customer });
});

// POST /customers
exports.create = asyncHandler(async (req, res) => {
  const { name, mobile, email, address } = req.body;
  if (!name || !mobile) throw new ApiError(422, "name and mobile are required.");
  const customer = await Customer.create({ name, mobile, email, address });
  return success(res, "Add new customer", { customer }, 201);
});

// PUT /customers/:id
exports.update = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found.");

  ["name", "mobile", "email", "address"].forEach((f) => {
    if (req.body[f] !== undefined) customer[f] = req.body[f];
  });
  await customer.save();
  return success(res, "Update customer", { customer });
});

// DELETE /customers/:id
exports.remove = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found.");
  return success(res, "Delete customer");
});

// GET /customers/search
exports.search = asyncHandler(async (req, res) => {
  const { keyword = "" } = req.query;
  const customers = await Customer.find({
    status: "active",
    $or: [{ name: { $regex: keyword, $options: "i" } }, { mobile: { $regex: keyword, $options: "i" } }],
  }).limit(50);
  return success(res, "Search customer by name/mobile", { customers });
});

// GET /customers/:id/history
exports.purchaseHistory = asyncHandler(async (req, res) => {
  const history = await Cart.find({ customer: req.params.id, status: "completed" })
    .sort({ createdAt: -1 })
    .select("invoiceNo grandTotal paymentMethod createdAt");
  return success(res, "Customer purchase history", { history });
});

// GET /customers/:id/total-purchase
exports.totalPurchase = asyncHandler(async (req, res) => {
  const agg = await Cart.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(req.params.id), status: "completed" } },
    { $group: { _id: null, total: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
  ]);
  return success(res, "Total purchase amount", {
    totalPurchase: agg[0]?.total || 0,
    totalOrders: agg[0]?.orders || 0,
  });
});

// GET /customers/:id/invoices
exports.invoices = asyncHandler(async (req, res) => {
  const invoices = await Cart.find({ customer: req.params.id, status: "completed" }).sort({
    createdAt: -1,
  });
  return success(res, "Customer invoices", { invoices });
});

// GET /customers/export
exports.exportList = asyncHandler(async (req, res) => {
  const customers = await Customer.find().lean();
  const fields = ["name", "mobile", "email", "address", "totalPurchase", "status", "createdAt"];
  const parser = new Parser({ fields });
  const csv = parser.parse(customers);

  res.header("Content-Type", "text/csv");
  res.attachment("customers.csv");
  return res.send(csv);
});

// PATCH /customers/:id/status
exports.setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) throw new ApiError(422, "Invalid status.");
  const customer = await Customer.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!customer) throw new ApiError(404, "Customer not found.");
  return success(res, "Enable/Disable customer", { customer });
});

// GET /customers/dropdown
exports.dropdown = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ status: "active" }).select("name mobile").sort({ name: 1 });
  return success(res, "Customer dropdown for billing", { customers });
});
