const Category = require("../models/Category");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");

// GET /categories
exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query;
  const filter = search ? { name: { $regex: search, $options: "i" } } : {};

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Category.countDocuments(filter),
  ]);

  return success(res, "Get Category List", {
    categories,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /categories/:id
exports.getOne = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found.");
  return success(res, "Category Details", { category });
});

// POST /categories
exports.create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new ApiError(422, "Category name is required.");
  const category = await Category.create({ name, description });
  return success(res, "Category added successfully", { category }, 201);
});

// PUT /categories/:id
exports.update = asyncHandler(async (req, res) => {
  const { name, description, status } = req.body;
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found.");

  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (status) category.status = status;
  await category.save();

  return success(res, "Category updated successfully", { category });
});

// DELETE /categories/:id
exports.remove = asyncHandler(async (req, res) => {
  const inUse = await Product.exists({ category: req.params.id });
  if (inUse) {
    throw new ApiError(422, "Cannot delete category. Products exist under this category.");
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, "Category not found.");
  return success(res, "Category deleted successfully");
});

// GET /categories/dropdown
exports.dropdown = asyncHandler(async (req, res) => {
  const categories = await Category.find({ status: "active" }).select("name").sort({ name: 1 });
  return success(res, "Category Dropdown List", { categories });
});

// GET /categories/:id/products
exports.products = asyncHandler(async (req, res) => {
  const products = await Product.find({ category: req.params.id }).sort({ name: 1 });
  return success(res, "Products Under Category", { products });
});

// GET /categories/check/:id
exports.checkUsage = asyncHandler(async (req, res) => {
  const count = await Product.countDocuments({ category: req.params.id });
  return success(res, "Check Category Usage Before Delete", {
    inUse: count > 0,
    productCount: count,
  });
});
