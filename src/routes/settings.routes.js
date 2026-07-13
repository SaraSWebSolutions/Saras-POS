const express = require("express");
const router = express.Router();

const {
  getShopProfile,
  updateShopProfile,
  getTax,
  updateTax,
  getBilling,
  updateBilling,
  getPrinter,
  updatePrinter,
  listUsers,
  backup,
  restore,
  about,
} = require("../controllers/settings.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadBulkFile } = require("../middleware/upload");

router.use(protect);

router.get("/shop-profile", getShopProfile);
router.put("/shop-profile", authorize("admin"), updateShopProfile);

router.get("/tax", getTax);
router.put("/tax", authorize("admin"), updateTax);

router.get("/billing", getBilling);
router.put("/billing", authorize("admin"), updateBilling);

router.get("/printer", getPrinter);
router.put("/printer", authorize("admin"), updatePrinter);

router.get("/users", authorize("admin"), listUsers);

router.post("/backup", authorize("admin"), backup);
router.post(
  "/restore",
  authorize("admin"),
  uploadBulkFile.single("file"),
  restore,
);

router.get("/about", about);

module.exports = router;
