const fs = require("fs");
const path = require("path");
const Settings = require("../models/Settings");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { uploadDir } = require("../middleware/upload");
const { fileUrl } = require("../utils/exporter");

async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

// GET /settings/shop-profile
exports.getShopProfile = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return success(res, "Get shop profile", { shopProfile: settings.shopProfile });
});

// PUT /settings/shop-profile
exports.updateShopProfile = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  settings.shopProfile = { ...settings.shopProfile.toObject(), ...req.body };
  await settings.save();
  return success(res, "Update shop profile", { shopProfile: settings.shopProfile });
});

// GET /settings/tax
exports.getTax = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return success(res, "Get tax settings", { tax: settings.tax });
});

// PUT /settings/tax
exports.updateTax = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  settings.tax = { ...settings.tax.toObject(), ...req.body };
  await settings.save();
  return success(res, "Update GST/CGST/SGST", { tax: settings.tax });
});

// GET /settings/billing
exports.getBilling = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return success(res, "Get billing settings", { billing: settings.billing });
});

// PUT /settings/billing
exports.updateBilling = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  settings.billing = { ...settings.billing.toObject(), ...req.body };
  await settings.save();
  return success(res, "Update billing settings", { billing: settings.billing });
});

// GET /settings/printer
exports.getPrinter = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return success(res, "Get printer configuration", { printer: settings.printer });
});

// PUT /settings/printer
exports.updatePrinter = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  settings.printer = { ...settings.printer.toObject(), ...req.body };
  await settings.save();
  return success(res, "Save printer configuration", { printer: settings.printer });
});

// GET /settings/users
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -otp -otpExpiry -resetToken -resetTokenExpiry");
  return success(res, "User management list", { users });
});

// POST /settings/backup
exports.backup = asyncHandler(async (req, res) => {
  const [settings, users, products, categories, customers] = await Promise.all([
    Settings.findOne().lean(),
    User.find().select("-password").lean(),
    Product.find().lean(),
    Category.find().lean(),
    Customer.find().lean(),
  ]);

  const payload = { settings, users, products, categories, customers, generatedAt: new Date() };
  const filename = `backup-${Date.now()}.json`;
  fs.writeFileSync(path.join(uploadDir, filename), JSON.stringify(payload, null, 2));

  return success(res, "Create backup", { backupUrl: fileUrl(req, filename) });
});

// POST /settings/restore
exports.restore = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Backup JSON file is required.");

  const raw = fs.readFileSync(req.file.path, "utf-8");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    throw new ApiError(422, "Invalid backup file. Must be valid JSON.");
  }

  if (payload.categories?.length) {
    await Category.deleteMany({});
    await Category.insertMany(payload.categories);
  }
  if (payload.products?.length) {
    await Product.deleteMany({});
    await Product.insertMany(payload.products);
  }
  if (payload.customers?.length) {
    await Customer.deleteMany({});
    await Customer.insertMany(payload.customers);
  }
  if (payload.settings) {
    await Settings.deleteMany({});
    await Settings.create(payload.settings);
  }

  fs.unlink(req.file.path, () => {});
  return success(res, "Restore backup");
});

// GET /settings/about
exports.about = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return success(res, "App version & company details", { about: settings.about });
});
