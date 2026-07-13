const express = require("express");
const router = express.Router();

const {
  dropdown,
  checkUsage,
  products,
  list,
  getOne,
  create,
  update,
  remove,
} = require("../controllers/categories.controller");

const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/dropdown", dropdown);
router.get("/check/:id", checkUsage);
router.get("/:id/products", products);

router.get("/", list);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
