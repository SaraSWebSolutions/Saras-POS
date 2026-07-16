const express = require("express");
const router = express.Router();

const {
  all,
  summary,
  salesChart,
  recentOrders,
  topProducts,
  lowStock,
  notifications,
} = require("../controllers/dashboard.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", all);
router.get("/summary", summary);
router.get("/sales-chart", salesChart);
router.get("/recent-orders", recentOrders);
router.get("/top-products", topProducts);
router.get("/low-stock", lowStock);
router.get("/notifications", notifications);

module.exports = router;
