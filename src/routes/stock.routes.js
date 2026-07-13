const express = require("express");
const router = express.Router();

const {
  current,
  stockIn,
  stockOut,
  history,
  low,
  adjustment,
  search,
  exportPdf,
  exportExcel,
  dashboard,
  byProduct,
  byCategory,
  stockInDetails,
  stockOutDetails,
  productHistory,
} = require("../controllers/stock.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/current", current);
router.post("/in", stockIn);
router.post("/out", stockOut);
router.get("/history", history);
router.get("/low", low);
router.post("/adjustment", adjustment);
router.get("/search", search);
router.get("/export/pdf", exportPdf);
router.get("/export/excel", exportExcel);
router.get("/dashboard", dashboard);

router.get("/product/:id", byProduct);
router.get("/category/:id", byCategory);
router.get("/in/:id", stockInDetails);
router.get("/out/:id", stockOutDetails);
router.get("/history/:id", productHistory);

module.exports = router;
