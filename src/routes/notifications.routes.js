const express = require("express");
const router = express.Router();

const {
  unreadCount,
  markAllRead,
  removeMultiple,
  clearAll,
  list,
  getOne,
  markRead,
  remove,
  createTest,
} = require("../controllers/notifications.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/unread-count", unreadCount);
router.put("/read-all", markAllRead);
router.post("/delete-multiple", removeMultiple);
router.delete("/clear-all", clearAll);
router.post("/test", createTest);

router.get("/", list);
router.get("/:id", getOne);
router.put("/:id/read", markRead);
router.delete("/:id", remove);

module.exports = router;
