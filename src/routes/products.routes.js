const express = require("express");
const router = express.Router();

const {
  search,
  lowStock,
  getByBarcode,
  generateBarcode,
  byCategory,
  uploadImage,
  stockUpdate,
  bulkUpload,
  bulkDelete,
  setStatus,
  list,
  getOne,
  create,
  update,
  remove,
} = require("../controllers/products.controller");
const { protect, authorize } = require("../middleware/auth");
const { upload, uploadBulkFile } = require("../middleware/upload");

router.use(protect);

// Specific routes before the /:id catch-alls
router.get("/search", search);
router.get("/low-stock", lowStock);
router.get("/barcode/:barcode", getByBarcode);
router.post("/barcode/generate", generateBarcode);
router.get("/category/:id", byCategory);
router.post("/upload-image", upload.single("image"), uploadImage);
router.post("/stock-update", stockUpdate);
router.post("/bulk-upload", uploadBulkFile.single("file"), bulkUpload);
router.delete("/bulk-delete", bulkDelete);
router.put("/status", setStatus);

router.get("/", list);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", authorize("admin"), remove);

module.exports = router;
