const crypto = require("crypto");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { signToken } = require("../utils/jwt");
const { generateOTP, sendOTPEmail } = require("../utils/email");

// POST /auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new ApiError(422, "Email and password are required.");

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password.");
  }
  if (user.status !== "active")
    throw new ApiError(403, "Your account has been disabled.");

  const token = signToken({ id: user._id, role: user.role });
  return success(res, "Login successful", { token, user: user.toSafeObject() });
});

// POST /auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(422, "Email is required.");

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, "No account found with this email.");

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  await sendOTPEmail(user.email, otp);

  return success(res, "OTP sent to your registered email.");
});

// POST /auth/verify-otp
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new ApiError(422, "Email and OTP are required.");

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpiry",
  );
  if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
    throw new ApiError(400, "Invalid or expired OTP.");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return success(res, "OTP verified.", { resetToken });
});

// POST /auth/reset-password
exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  if (!email || !resetToken || !newPassword) {
    throw new ApiError(422, "Email, resetToken and newPassword are required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+resetToken +resetTokenExpiry",
  );
  if (
    !user ||
    user.resetToken !== resetToken ||
    user.resetTokenExpiry < Date.now()
  ) {
    throw new ApiError(
      400,
      "Invalid or expired reset token. Please request OTP again.",
    );
  }

  user.password = newPassword;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  return success(res, "Password reset successful. Please login.");
});

// GET /auth/profile
exports.getProfile = asyncHandler(async (req, res) => {
  return success(res, "Profile fetched", { user: req.user.toSafeObject() });
});

// PUT /auth/update-profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;
  await user.save();
  return success(res, "Profile updated", { user: user.toSafeObject() });
});

// PUT /auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new ApiError(422, "oldPassword and newPassword are required.");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(oldPassword))) {
    throw new ApiError(400, "Old password is incorrect.");
  }
  user.password = newPassword;
  await user.save();
  return success(res, "Password changed successfully.");
});

// POST /auth/logout
exports.logout = asyncHandler(async (req, res) => {
  // JWTs are stateless; the client is responsible for discarding the token.
  // (Add a token-blacklist collection here if server-side invalidation is required.)
  return success(res, "Logged out successfully.");
});
