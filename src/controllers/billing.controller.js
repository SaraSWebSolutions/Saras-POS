const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const StockHistory = require("../models/StockHistory");
const Settings = require("../models/Settings");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { nextInvoiceNumber, nextStockRefNumber } = require("../utils/sequence");
const { notifyLowStock, notifyNewOrder } = require("../utils/notify");
const { uploadDir } = require("../middleware/upload");
const { fileUrl } = require("../utils/exporter");

// ---------- helpers ----------

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Recalculates subtotal, GST, discount and grand total for a cart, then saves it.
async function recalculateCart(cart) {
  let subtotal = 0;
  let gstAmount = 0;

  cart.items.forEach((item) => {
    const lineBase = item.price * item.qty;
    const lineGst = round2((lineBase * (item.gstRate || 0)) / 100);
    item.gstAmount = lineGst;
    item.total = round2(lineBase + lineGst);
    subtotal += lineBase;
    gstAmount += lineGst;
  });

  subtotal = round2(subtotal);
  gstAmount = round2(gstAmount);

  let discountAmount = 0;
  if (cart.discountType === "flat") {
    discountAmount = cart.discountValue || 0;
  } else if (cart.discountType === "percentage") {
    discountAmount = round2((subtotal * (cart.discountValue || 0)) / 100);
  }
  discountAmount = Math.min(discountAmount, subtotal);

  cart.subtotal = subtotal;
  cart.gstAmount = gstAmount;
  cart.discountAmount = round2(discountAmount);
  cart.grandTotal = round2(subtotal + gstAmount - discountAmount);

  await cart.save();
  return cart;
}

async function findActiveCart(cartId) {
  const cart = await Cart.findById(cartId).populate("customer", "name mobile");
  if (!cart) throw new ApiError(404, "Cart not found.");
  if (!["active", "hold"].includes(cart.status)) {
    throw new ApiError(
      422,
      "This cart is not editable (already completed/cancelled).",
    );
  }
  return cart;
}

// ---------- Billing screen product helpers ----------

// GET /billing/products
exports.billingProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ status: "active" }).populate(
    "category",
    "name",
  );
  return success(res, "Get all products for billing", { products });
});

// GET /billing/products/search
exports.billingSearchProducts = asyncHandler(async (req, res) => {
  const { keyword = "" } = req.query;
  const products = await Product.find({
    status: "active",
    name: { $regex: keyword, $options: "i" },
  }).limit(50);
  return success(res, "Search product by name", { products });
});

// GET /billing/products/barcode/:barcode
exports.billingProductByBarcode = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    barcode: req.params.barcode,
    status: "active",
  });
  if (!product) throw new ApiError(404, "Product not found for this barcode.");
  return success(res, "Get product by barcode", { product });
});

// ---------- Cart lifecycle ----------

// POST /billing/cart
exports.createCart = asyncHandler(async (req, res) => {
  const cart = await Cart.create({ items: [], createdBy: req.user._id });
  return success(res, "Create new cart/session", { cart }, 201);
});

// GET /billing/cart/:cartId
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findById(req.params.cartId).populate(
    "customer",
    "name mobile",
  );
  if (!cart) throw new ApiError(404, "Cart not found.");
  return success(res, "Get current cart details", { cart });
});

// POST /billing/cart/add-item
exports.addItem = asyncHandler(async (req, res) => {
  const { cartId, product_id, barcode, qty = 1 } = req.body;
  if (!cartId || (!product_id && !barcode)) {
    throw new ApiError(422, "cartId and product_id or barcode are required.");
  }

  const cart = await findActiveCart(cartId);
  const product = product_id
    ? await Product.findById(product_id)
    : await Product.findOne({ barcode });
  if (!product) throw new ApiError(404, "Product not found.");

  const settings = await Settings.findOne();
  if (
    !settings?.billing?.allowNegativeStock &&
    product.stockQty < qty &&
    !cart.items.find((i) => i.product.toString() === product._id.toString())
  ) {
    throw new ApiError(422, "Insufficient stock for this product.");
  }

  const existing = cart.items.find(
    (i) => i.product.toString() === product._id.toString(),
  );
  if (existing) {
    existing.qty += Number(qty);
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      price: product.sellingPrice,
      qty: Number(qty),
      gstRate: product.gstRate,
    });
  }

  await recalculateCart(cart);
  return success(res, "Add product to cart", { cart });
});

// PUT /billing/cart/update-item
exports.updateItem = asyncHandler(async (req, res) => {
  const { cartId, product_id, qty } = req.body;
  if (!cartId || !product_id || qty === undefined) {
    throw new ApiError(422, "cartId, product_id and qty are required.");
  }

  const cart = await findActiveCart(cartId);
  const item = cart.items.find((i) => i.product.toString() === product_id);
  if (!item) throw new ApiError(404, "Item not found in cart.");

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== product_id);
  } else {
    item.qty = Number(qty);
  }

  await recalculateCart(cart);
  return success(res, "Increase/Decrease quantity", { cart });
});

// DELETE /billing/cart/remove-item
exports.removeItem = asyncHandler(async (req, res) => {
  const { cartId, product_id } = req.body;
  if (!cartId || !product_id)
    throw new ApiError(422, "cartId and product_id are required.");

  const cart = await findActiveCart(cartId);
  cart.items = cart.items.filter((i) => i.product.toString() !== product_id);

  await recalculateCart(cart);
  return success(res, "Remove item from cart", { cart });
});

// DELETE /billing/cart/clear
exports.clearCart = asyncHandler(async (req, res) => {
  const { cartId } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await findActiveCart(cartId);
  cart.items = [];
  cart.discountType = "none";
  cart.discountValue = 0;

  await recalculateCart(cart);
  return success(res, "Clear complete cart", { cart });
});

// POST /billing/cart/apply-discount
exports.applyDiscount = asyncHandler(async (req, res) => {
  const { cartId, discountType, discountValue } = req.body;
  if (
    !cartId ||
    !["flat", "percentage"].includes(discountType) ||
    discountValue === undefined
  ) {
    throw new ApiError(
      422,
      "cartId, discountType(flat/percentage) and discountValue are required.",
    );
  }

  const cart = await findActiveCart(cartId);
  cart.discountType = discountType;
  cart.discountValue = Number(dis.countValue);

  await recalculateCart(cart);
  return success(res, "Apply bill discount", { cart });
});

// DELETE /billing/cart/remove-discount
exports.removeDiscount = asyncHandler(async (req, res) => {
  const { cartId } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await findActiveCart(cartId);
  cart.discountType = "none";
  cart.discountValue = 0;

  await recalculateCart(cart);
  return success(res, "Remove discount", { cart });
});

// POST /billing/cart/apply-tax
exports.applyTax = asyncHandler(async (req, res) => {
  const { cartId } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await findActiveCart(cartId);
  await recalculateCart(cart); // GST is recalculated per item automatically
  return success(res, "Calculate GST", { cart });
});

// GET /billing/cart/summary
exports.cartSummary = asyncHandler(async (req, res) => {
  const { cartId } = req.query;
  if (!cartId) throw new ApiError(422, "cartId query param is required.");

  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found.");

  return success(res, "Get subtotal, GST, total", {
    subtotal: cart.subtotal,
    discountAmount: cart.discountAmount,
    gstAmount: cart.gstAmount,
    grandTotal: cart.grandTotal,
  });
});

// ---------- Customer during billing ----------

// GET /billing/customer/search
exports.searchCustomer = asyncHandler(async (req, res) => {
  const { keyword = "" } = req.query;
  const customers = await Customer.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { mobile: { $regex: keyword, $options: "i" } },
    ],
  }).limit(20);
  return success(res, "Search customer", { customers });
});

// POST /billing/customer/add
exports.addCustomerDuringBilling = asyncHandler(async (req, res) => {
  const { cartId, name, mobile, email, address } = req.body;
  if (!name || !mobile)
    throw new ApiError(422, "name and mobile are required.");

  let customer = await Customer.findOne({ mobile });
  if (!customer)
    customer = await Customer.create({ name, mobile, email, address });

  if (cartId) {
    const cart = await findActiveCart(cartId);
    cart.customer = customer._id;
    await cart.save();
  }

  return success(res, "Add customer during billing", { customer }, 201);
});

// ---------- Hold / Resume / Cancel ----------

// POST /billing/hold
exports.holdBill = asyncHandler(async (req, res) => {
  const { cartId, holdName } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await Cart.findById(cartId);
  if (!cart || cart.status !== "active")
    throw new ApiError(422, "Only an active cart can be held.");

  cart.status = "hold";
  cart.holdName = holdName || "";
  await cart.save();

  return success(res, "Hold current bill", { cart });
});

// GET /billing/hold/list
exports.holdList = asyncHandler(async (req, res) => {
  const carts = await Cart.find({ status: "hold" })
    .populate("customer", "name mobile")
    .sort({ createdAt: -1 });
  return success(res, "Get all held bills", { carts });
});

// GET /billing/hold/:id
exports.holdDetails = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({
    _id: req.params.id,
    status: "hold",
  }).populate("customer", "name mobile");
  if (!cart) throw new ApiError(404, "Held bill not found.");
  return success(res, "Get held bill details", { cart });
});

// POST /billing/resume/:id
exports.resumeHold = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ _id: req.params.id, status: "hold" });
  if (!cart) throw new ApiError(404, "Held bill not found.");

  cart.status = "active";
  await cart.save();

  return success(res, "Resume held bill", { cart });
});

// DELETE /billing/hold/delete/:id
exports.deleteHold = asyncHandler(async (req, res) => {
  const cart = await Cart.findOneAndDelete({
    _id: req.params.id,
    status: "hold",
  });
  if (!cart) throw new ApiError(404, "Held bill not found.");
  return success(res, "Delete held bill");
});

// POST /billing/cancel/:id
exports.cancelBill = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const cart = await Cart.findById(req.params.id);
  if (!cart) throw new ApiError(404, "Bill not found.");
  if (cart.status === "cancelled")
    throw new ApiError(422, "Bill is already cancelled.");

  // If it was already completed, restore stock for each item.
  if (cart.status === "completed") {
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const previousStock = product.stockQty;
        product.stockQty += item.qty;
        await product.save();
        const refNo = await nextStockRefNumber("in");
        await StockHistory.create({
          refNo,
          product: product._id,
          type: "refund",
          qty: item.qty,
          previousStock,
          newStock: product.stockQty,
          reason: `Bill cancelled: ${cart.invoiceNo}`,
          reference: cart.invoiceNo,
          createdBy: req.user._id,
        });
      }
    }
  }

  cart.status = "cancelled";
  cart.cancelReason = reason || "";
  await cart.save();

  return success(res, "Cancel bill", { cart });
});

// ---------- Payment ----------

// POST /billing/payment/cash
exports.paymentCash = asyncHandler(async (req, res) => {
  const { cartId, amountReceived } = req.body;
  const cart = await findActiveCart(cartId);

  cart.paymentMethod = "cash";
  cart.paymentDetails = {
    cashAmount: amountReceived ?? cart.grandTotal,
    upiAmount: 0,
    upiRefNo: "",
  };
  cart.paymentStatus = "paid";
  await cart.save();

  return success(res, "Cash payment", {
    cart,
    changeDue: round2((amountReceived ?? cart.grandTotal) - cart.grandTotal),
  });
});

// POST /billing/payment/upi
exports.paymentUpi = asyncHandler(async (req, res) => {
  const { cartId, upiRefNo } = req.body;
  const cart = await findActiveCart(cartId);

  cart.paymentMethod = "upi";
  cart.paymentDetails = {
    cashAmount: 0,
    upiAmount: cart.grandTotal,
    upiRefNo: upiRefNo || "",
  };
  cart.paymentStatus = "paid";
  await cart.save();

  return success(res, "UPI payment", { cart });
});

// POST /billing/payment/split
exports.paymentSplit = asyncHandler(async (req, res) => {
  const { cartId, cashAmount, upiAmount, upiRefNo } = req.body;
  const cart = await findActiveCart(cartId);

  const total = round2(Number(cashAmount || 0) + Number(upiAmount || 0));
  if (total !== cart.grandTotal) {
    throw new ApiError(
      422,
      `Split amounts (${total}) must equal the grand total (${cart.grandTotal}).`,
    );
  }

  cart.paymentMethod = "split";
  cart.paymentDetails = {
    cashAmount: Number(cashAmount || 0),
    upiAmount: Number(upiAmount || 0),
    upiRefNo: upiRefNo || "",
  };
  cart.paymentStatus = "paid";
  await cart.save();

  return success(res, "Split payment (Cash + UPI)", { cart });
});

// GET /billing/payment-status/:invoiceNo
exports.paymentStatus = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ invoiceNo: req.params.invoiceNo });
  if (!cart) throw new ApiError(404, "Invoice not found.");
  return success(res, "Check payment status", {
    invoiceNo: cart.invoiceNo,
    paymentStatus: cart.paymentStatus,
    paymentMethod: cart.paymentMethod,
  });
});

// ---------- Invoice generation ----------

// POST /billing/invoice/generate
exports.generateInvoice = asyncHandler(async (req, res) => {
  const { cartId } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found.");
  if (cart.status !== "active")
    throw new ApiError(422, "Only an active cart can be invoiced.");
  if (cart.items.length === 0)
    throw new ApiError(422, "Cannot generate invoice for an empty cart.");
  if (cart.paymentStatus !== "paid")
    throw new ApiError(
      422,
      "Payment must be completed before generating the invoice.",
    );

  // Reduce stock and log stock history for each item
  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    const previousStock = product.stockQty;
    product.stockQty = Math.max(0, product.stockQty - item.qty);
    await product.save();

    await StockHistory.create({
      refNo: await nextStockRefNumber("out"),
      product: product._id,
      type: "sale",
      qty: item.qty,
      previousStock,
      newStock: product.stockQty,
      reason: "Billing sale",
      reference: cart.invoiceNo || "PENDING",
      createdBy: req.user._id,
    });

    await notifyLowStock(product);
  }

  cart.invoiceNo = await nextInvoiceNumber();
  cart.status = "completed";
  await cart.save();

  // Backfill stock history reference now that invoice number exists
  await StockHistory.updateMany(
    { reference: "PENDING" },
    { reference: cart.invoiceNo },
  );

  if (cart.customer) {
    await Customer.findByIdAndUpdate(cart.customer, {
      $inc: { totalPurchase: cart.grandTotal },
    });
  }

  const populated = await Cart.findById(cart._id).populate(
    "customer",
    "name mobile",
  );
  await notifyNewOrder(populated);
  return success(res, "Generate invoice", { invoice: populated }, 201);
});

// GET /billing/invoice/:invoiceNo
exports.getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Cart.findOne({
    invoiceNo: req.params.invoiceNo,
  }).populate("customer", "name mobile email address");
  if (!invoice) throw new ApiError(404, "Invoice not found.");
  return success(res, "Get invoice details", { invoice });
});

// GET /billing/print/:invoiceNo
exports.printReceipt = asyncHandler(async (req, res) => {
  const invoice = await Cart.findOne({
    invoiceNo: req.params.invoiceNo,
  }).populate("customer", "name mobile");
  if (!invoice) throw new ApiError(404, "Invoice not found.");

  const settings = await Settings.findOne();

  return success(res, "Get printable receipt data", {
    shop: settings?.shopProfile || {},
    printerWidth: settings?.printer?.width || "80mm",
    invoiceNo: invoice.invoiceNo,
    date: invoice.createdAt,
    customer: invoice.customer,
    items: invoice.items,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    gstAmount: invoice.gstAmount,
    grandTotal: invoice.grandTotal,
    paymentMethod: invoice.paymentMethod,
  });
});

// Builds a simple PDF invoice on disk and returns its public URL.
async function buildInvoicePdf(req, invoice, shop) {
  const filename = `invoice-${invoice.invoiceNo}.pdf`;
  const filePath = path.join(uploadDir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A5" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(16).text(shop?.shopName || "Saras POS", { align: "center" });
    doc.fontSize(9).text(shop?.address || "", { align: "center" });
    doc.moveDown();
    doc.fontSize(11).text(`Invoice: ${invoice.invoiceNo}`);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`);
    if (invoice.customer)
      doc.text(
        `Customer: ${invoice.customer.name} (${invoice.customer.mobile})`,
      );
    doc.moveDown();

    invoice.items.forEach((item) => {
      doc
        .fontSize(10)
        .text(`${item.name}  x${item.qty}  @${item.price}  = ${item.total}`);
    });

    doc.moveDown();
    doc.text(`Subtotal: ${invoice.subtotal}`);
    doc.text(`Discount: ${invoice.discountAmount}`);
    doc.text(`GST: ${invoice.gstAmount}`);
    doc
      .fontSize(12)
      .text(`Grand Total: ${invoice.grandTotal}`, { underline: true });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return fileUrl(req, filename);
}

// GET /billing/share/whatsapp/:invoiceNo
exports.shareWhatsapp = asyncHandler(async (req, res) => {
  const invoice = await Cart.findOne({
    invoiceNo: req.params.invoiceNo,
  }).populate("customer", "name mobile");
  if (!invoice) throw new ApiError(404, "Invoice not found.");

  const settings = await Settings.findOne();
  const url = await buildInvoicePdf(req, invoice, settings?.shopProfile);

  return success(res, "Get invoice PDF/URL for WhatsApp", { pdfUrl: url });
});

// GET /billing/history
exports.history = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, paymentMethod } = req.query;
  const filter = { status: "completed" };
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [invoices, total] = await Promise.all([
    Cart.find(filter)
      .populate("customer", "name mobile")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Cart.countDocuments(filter),
  ]);

  return success(res, "Billing history", {
    invoices,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// DELETE /billing/delete/:invoiceNo
exports.deleteInvoice = asyncHandler(async (req, res) => {
  const invoice = await Cart.findOneAndDelete({
    invoiceNo: req.params.invoiceNo,
  });
  if (!invoice) throw new ApiError(404, "Invoice not found.");
  return success(res, "Delete invoice (Admin only)");
});

// POST /billing/refund
exports.refund = asyncHandler(async (req, res) => {
  const { invoiceNo, reason, restoreStock = true } = req.body;
  if (!invoiceNo) throw new ApiError(422, "invoiceNo is required.");

  const invoice = await Cart.findOne({ invoiceNo });
  if (!invoice) throw new ApiError(404, "Invoice not found.");
  if (invoice.paymentStatus === "refunded")
    throw new ApiError(422, "Invoice already refunded.");

  if (restoreStock) {
    for (const item of invoice.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;
      const previousStock = product.stockQty;
      product.stockQty += item.qty;
      await product.save();
      await StockHistory.create({
        refNo: await nextStockRefNumber("in"),
        product: product._id,
        type: "refund",
        qty: item.qty,
        previousStock,
        newStock: product.stockQty,
        reason: reason || "Refund",
        reference: invoice.invoiceNo,
        createdBy: req.user._id,
      });
    }
  }

  invoice.paymentStatus = "refunded";
  invoice.cancelReason = reason || "";
  await invoice.save();

  return success(res, "Refund completed bill", { invoice });
});

// GET /billing/invoice-number
exports.peekInvoiceNumber = asyncHandler(async (req, res) => {
  const settings = await Settings.findOne();
  const prefix = settings?.billing?.invoicePrefix || "INV";
  const Counter = require("../models/Counter");
  const counter = await Counter.findOne({ key: "invoice" });
  const nextSeq = (counter?.seq || 0) + 1;
  return success(res, "Get next invoice number", {
    nextInvoiceNo: `${prefix}-${String(nextSeq).padStart(4, "0")}`,
  });
});

// GET /billing/settings
exports.billingSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.findOne();
  return success(res, "Get billing settings (GST, Prefix, Currency)", {
    tax: settings?.tax || {},
    billing: settings?.billing || {},
  });
});

// POST /billing/kot/generate
exports.generateKot = asyncHandler(async (req, res) => {
  const { cartId } = req.body;
  if (!cartId) throw new ApiError(422, "cartId is required.");

  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found.");

  cart.isKOTGenerated = true;
  await cart.save();

  return success(res, "Generate Kitchen Order Ticket (Restaurant POS)", {
    kot: {
      cartId: cart._id,
      items: cart.items.map((i) => ({ name: i.name, qty: i.qty })),
      generatedAt: new Date(),
    },
  });
});
