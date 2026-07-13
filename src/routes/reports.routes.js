const express = require("express");
const router = express.Router();

const {
  dashboardReport,
  todaySales,
  dailyReport,
  monthlyReport,
  productWise,
  customerWise,
  gstReport,
  paymentReport,
  topSelling,
  lowStockReport,
  salesSummary,
  profitLoss,
  invoicesReport,
  cancelledBills,
  holdBills,
  exportPdf,
  exportExcel,
  chartDaily,
  chartMonthly,
  chartTopProducts,
} = require("../controllers/reports.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/dashboard", dashboardReport);
router.get("/today-sales", todaySales);
router.get("/daily", dailyReport);
router.get("/monthly", monthlyReport);
router.get("/product-wise", productWise);
router.get("/customer-wise", customerWise);
router.get("/gst", gstReport);
router.get("/payment", paymentReport);
router.get("/top-selling", topSelling);
router.get("/low-stock", lowStockReport);
router.get("/sales-summary", salesSummary);
router.get("/profit-loss", profitLoss);
router.get("/invoices", invoicesReport);
router.get("/cancelled-bills", cancelledBills);
router.get("/hold-bills", holdBills);
router.get("/export/pdf", exportPdf);
router.get("/export/excel", exportExcel);
router.get("/chart/daily", chartDaily);
router.get("/chart/monthly", chartMonthly);
router.get("/chart/top-products", chartTopProducts);

module.exports = router;
