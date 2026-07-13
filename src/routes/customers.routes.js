const express = require("express");
const router = express.Router();

const {
  search,
  exportList,
  dropdown,
  purchaseHistory,
  totalPurchase,
  invoices,
  setStatus,
  list,
  getOne,
  create,
  update,
  remove,
} = require("../controllers/customers.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/search", search);
router.get("/export", exportList);
router.get("/dropdown", dropdown);
router.get("/:id/history", purchaseHistory);
router.get("/:id/total-purchase", totalPurchase);
router.get("/:id/invoices", invoices);
router.patch("/:id/status", setStatus);

router.get("/", list);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
