const express = require("express");
const router = express.Router();

const {
  // Products for billing screen
  billingProducts,
  billingSearchProducts,
  billingProductByBarcode,

  // Cart
  createCart,
  cartSummary,
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  applyDiscount,
  removeDiscount,
  applyTax,

  // Customer during billing
  searchCustomer,
  addCustomerDuringBilling,

  // Hold / resume / cancel
  holdBill,
  holdList,
  holdDetails,
  resumeHold,
  deleteHold,
  cancelBill,

  // Payment
  paymentCash,
  paymentUpi,
  paymentSplit,
  paymentStatus,

  // Invoice
  generateInvoice,
  peekInvoiceNumber,
  getInvoice,
  printReceipt,
  shareWhatsapp,
  history,
  deleteInvoice,
  refund,
  billingSettings,

  // KOT (restaurant)
  generateKot,
} = require("../controllers/billing.controller");

const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Products for billing screen
router.get("/products", billingProducts);
router.get("/products/search", billingSearchProducts);
router.get("/products/barcode/:barcode", billingProductByBarcode);

// Cart
router.post("/cart", createCart);
router.get("/cart/summary", cartSummary); // before /cart/:cartId
router.get("/cart/:cartId", getCart);
router.post("/cart/add-item", addItem);
router.put("/cart/update-item", updateItem);
router.delete("/cart/remove-item", removeItem);
router.delete("/cart/clear", clearCart);
router.post("/cart/apply-discount", applyDiscount);
router.delete("/cart/remove-discount", removeDiscount);
router.post("/cart/apply-tax", applyTax);

// Customer during billing
router.get("/customer/search", searchCustomer);
router.post("/customer/add", addCustomerDuringBilling);

// Hold / resume / cancel
router.post("/hold", holdBill);
router.get("/hold/list", holdList);
router.get("/hold/:id", holdDetails);
router.post("/resume/:id", resumeHold);
router.delete("/hold/delete/:id", deleteHold);
router.post("/cancel/:id", cancelBill);

// Payment
router.post("/payment/cash", paymentCash);
router.post("/payment/upi", paymentUpi);
router.post("/payment/split", paymentSplit);
router.get("/payment-status/:invoiceNo", paymentStatus);

// Invoice
router.post("/invoice/generate", generateInvoice);
router.get("/invoice-number", peekInvoiceNumber); // before /invoice/:invoiceNo
router.get("/invoice/:invoiceNo", getInvoice);
router.get("/print/:invoiceNo", printReceipt);
router.get("/share/whatsapp/:invoiceNo", shareWhatsapp);
router.get("/history", history);
router.delete("/delete/:invoiceNo", authorize("admin"), deleteInvoice);
router.post("/refund", refund);
router.get("/settings", billingSettings);

// KOT (restaurant)
router.post("/kot/generate", generateKot);

module.exports = router;
