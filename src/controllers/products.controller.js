const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { uploadDir } = require("../middleware/upload");

function fileUrl(req, filename) {
  return `${process.env.BASE_URL || `${req.protocol}://${req.get("host")}`}/uploads/${filename}`;
}

// GET /products
exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = "", category_id } = req.query;
  const filter = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (category_id) filter.category = category_id;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return success(res, "Get Product List", {
    products,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /products/:id
exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name");
  if (!product) throw new ApiError(404, "Product not found.");
  return success(res, "Get Product Details", { product });
});

// POST /products
exports.create = asyncHandler(async (req, res) => {
  const {
    product_name,
    category_id,
    barcode,
    selling_price,
    purchase_price,
    stock_qty,
    gst_rate,
    unit,
    image,
  } = req.body;

  if (!product_name || !category_id || !barcode || selling_price === undefined) {
    throw new ApiError(422, "product_name, category_id, barcode and selling_price are required.");
  }
  const category = await Category.findById(category_id);
  if (!category) throw new ApiError(422, "Invalid category_id.");

  const product = await Product.create({
    name: product_name,
    category: category_id,
    barcode,
    sellingPrice: selling_price,
    purchasePrice: purchase_price || 0,
    stockQty: stock_qty || 0,
    gstRate: gst_rate || 0,
    unit: unit || "pcs",
    image: image || "",
  });

  return success(res, "Product added successfully", { product }, 201);
});

// PUT /products/:id
exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");

  const map = {
    product_name: "name",
    category_id: "category",
    barcode: "barcode",
    selling_price: "sellingPrice",
    purchase_price: "purchasePrice",
    stock_qty: "stockQty",
    gst_rate: "gstRate",
    unit: "unit",
    image: "image",
    status: "status",
  };
  Object.entries(map).forEach(([reqKey, field]) => {
    if (req.body[reqKey] !== undefined) product[field] = req.body[reqKey];
  });

  await product.save();
  return success(res, "Product updated successfully", { product });
});

// DELETE /products/:id
exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");
  return success(res, "Product deleted successfully");
});

// GET /products/barcode/:barcode
exports.getByBarcode = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ barcode: req.params.barcode }).populate(
    "category",
    "name"
  );
  if (!product) throw new ApiError(404, "Product not found for this barcode.");
  return success(res, "Search Product by Barcode", { product });
});

// GET /products/search
exports.search = asyncHandler(async (req, res) => {
  const { keyword = "" } = req.query;
  const products = await Product.find({
    status: "active",
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { barcode: { $regex: keyword, $options: "i" } },
    ],
  }).limit(50);
  return success(res, "Search Products", { products });
});

// GET /products/category/:id
exports.byCategory = asyncHandler(async (req, res) => {
  const products = await Product.find({ category: req.params.id, status: "active" });
  return success(res, "Products by Category", { products });
});

// POST /products/upload-image
exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Image file is required.");
  return success(res, "Upload Product Image", { imageUrl: fileUrl(req, req.file.filename) });
});

// POST /products/stock-update
exports.stockUpdate = asyncHandler(async (req, res) => {
  const { product_id, stock_qty } = req.body;
  if (!product_id || stock_qty === undefined) {
    throw new ApiError(422, "product_id and stock_qty are required.");
  }
  const product = await Product.findById(product_id);
  if (!product) throw new ApiError(404, "Product not found.");
  product.stockQty = stock_qty;
  await product.save();
  return success(res, "Update Product Stock", { product });
});

// GET /products/low-stock
exports.lowStock = asyncHandler(async (req, res) => {
  const { threshold } = req.query;
  const filter = threshold
    ? { stockQty: { $lte: Number(threshold) } }
    : { $expr: { $lte: ["$stockQty", "$lowStockThreshold"] } };
  const products = await Product.find(filter).populate("category", "name");
  return success(res, "Get Low Stock Products", { products });
});

// POST /products/bulk-upload  (multipart file: Excel/CSV)
exports.bulkUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Excel/CSV file is required.");

  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (ext === ".csv") {
    await workbook.csv.readFile(req.file.path);
  } else {
    await workbook.xlsx.readFile(req.file.path);
  }

  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row
    const [, name, categoryName, barcode, sellingPrice, purchasePrice, stockQty, gstRate, unit] =
      row.values;
    rows.push({ name, categoryName, barcode, sellingPrice, purchasePrice, stockQty, gstRate, unit });
  });

  const results = { created: 0, failed: [] };
  for (const row of rows) {
    try {
      let category = await Category.findOne({ name: row.categoryName });
      if (!category) category = await Category.create({ name: row.categoryName });

      await Product.create({
        name: row.name,
        category: category._id,
        barcode: String(row.barcode),
        sellingPrice: Number(row.sellingPrice || 0),
        purchasePrice: Number(row.purchasePrice || 0),
        stockQty: Number(row.stockQty || 0),
        gstRate: Number(row.gstRate || 0),
        unit: row.unit || "pcs",
      });
      results.created += 1;
    } catch (err) {
      results.failed.push({ row, error: err.message });
    }
  }

  fs.unlink(req.file.path, () => {});
  return success(res, "Import Products", results);
});

// DELETE /products/bulk-delete
exports.bulkDelete = asyncHandler(async (req, res) => {
  const { product_ids } = req.body;
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    throw new ApiError(422, "product_ids[] is required.");
  }
  await Product.deleteMany({ _id: { $in: product_ids } });
  return success(res, "Delete Multiple Products");
});

// PUT /products/status
exports.setStatus = asyncHandler(async (req, res) => {
  const { product_id, status } = req.body;
  if (!product_id || !["active", "inactive"].includes(status)) {
    throw new ApiError(422, "product_id and valid status (active/inactive) are required.");
  }
  const product = await Product.findByIdAndUpdate(product_id, { status }, { new: true });
  if (!product) throw new ApiError(404, "Product not found.");
  return success(res, "Enable/Disable Product", { product });
});

// POST /products/barcode/generate
exports.generateBarcode = asyncHandler(async (req, res) => {
  const { product_name, product_id } = req.body;

  // Generates a unique numeric barcode value (EAN-13 style, 13 digits)
  const base = Date.now().toString().slice(-12);
  const barcodeValue = base.padStart(13, "0");

  if (product_id) {
    const product = await Product.findByIdAndUpdate(
      product_id,
      { barcode: barcodeValue },
      { new: true }
    );
    if (!product) throw new ApiError(404, "Product not found.");
  }

  let imageUrl = null;
  try {
    const bwipjs = require("bwip-js");
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: barcodeValue,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });
    const filename = `barcode-${barcodeValue}.png`;
    fs.writeFileSync(path.join(uploadDir, filename), png);
    imageUrl = fileUrl(req, filename);
  } catch (err) {
    // barcode image generation is best-effort; the numeric value is always returned
  }

  return success(res, "Generate Barcode", {
    barcode: barcodeValue,
    label: product_name || null,
    imageUrl,
  });
});
