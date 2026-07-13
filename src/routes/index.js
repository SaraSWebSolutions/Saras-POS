const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/billing", require("./billing.routes"));
router.use("/products", require("./products.routes"));
router.use("/categories", require("./categories.routes"));
router.use("/customers", require("./customers.routes"));
router.use("/stock", require("./stock.routes"));
router.use("/reports", require("./reports.routes"));
router.use("/settings", require("./settings.routes"));
router.use("/notifications", require("./notifications.routes"));

module.exports = router;
