const express = require("express");
const router = express.Router();

const {
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  logout,
} = require("../controllers/auth.controller");

const { protect } = require("../middleware/auth");

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

router.get("/profile", protect, getProfile);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.post("/logout", protect, logout);

module.exports = router;
