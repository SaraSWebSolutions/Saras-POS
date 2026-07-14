const Notification = require("../models/Notification");

async function createNotification({ title, message, type = "general", forUser = null, meta = {} }) {
  return Notification.create({ title, message, type, forUser, meta });
}

// Called after any stock reduction (sale, stock-out, adjustment).
async function notifyLowStock(product) {
  if (product.stockQty > product.lowStockThreshold) return;

  // Avoid spamming: skip if an unread low-stock notification for this product
  // was already created in the last hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await Notification.findOne({
    type: "low_stock",
    "meta.productId": String(product._id),
    createdAt: { $gte: oneHourAgo },
  });
  if (recent) return;

  await createNotification({
    title: "Low Stock Alert",
    message: `${product.name} is running low (${product.stockQty} ${product.unit} left).`,
    type: "low_stock",
    meta: { productId: String(product._id), stockQty: product.stockQty },
  });
}

// Called right after an invoice is generated.
async function notifyNewOrder(invoice) {
  await createNotification({
    title: "New Order",
    message: `Invoice ${invoice.invoiceNo} generated for \u20b9${invoice.grandTotal}.`,
    type: "order",
    meta: { invoiceNo: invoice.invoiceNo, grandTotal: invoice.grandTotal },
  });
}

module.exports = { createNotification, notifyLowStock, notifyNewOrder };
