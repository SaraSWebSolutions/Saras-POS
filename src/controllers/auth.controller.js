const crypto = require("crypto");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");
const { signToken } = require("../utils/jwt");
const { generateOTP, sendOTPEmail } = require("../utils/email");

// POST /auth/register
exports.register = asyncHandler(async (req, res) => {
  const {
    username,
    password,
    businessName,
    country,
    agreedToTerms,
    email,
    name,
  } = req.body;

  const missing = [];
  if (!username) missing.push("username");
  if (!email) missing.push("email");
  if (!password) missing.push("password");
  if (!businessName) missing.push("businessName");
  if (!country) missing.push("country");
  if (agreedToTerms === undefined || agreedToTerms === null)
    missing.push("agreedToTerms");

  if (missing.length) {
    throw new ApiError(422, "Missing required fields.", {
      ...Object.fromEntries(missing.map((f) => [f, `${f} is required.`])),
    });
  }

  if (agreedToTerms !== true) {
    throw new ApiError(422, "Validation Error", {
      agreedToTerms: "You must accept the Terms & Conditions to register.",
    });
  }

  const existingUsername = await User.findOne({
    username: username.toLowerCase(),
  });
  if (existingUsername) {
    throw new ApiError(422, "Validation Error", {
      username: "This username is already taken.",
    });
  }

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(422, "Validation Error", {
      email: "This email is already registered.",
    });
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    businessName,
    country,
    agreedToTerms,
    name: name || businessName,
    role: "admin", // the person registering owns the business account
  });

  const token = signToken({ id: user._id, role: user.role });
  return success(
    res,
    "Registration successful",
    { token, user: user.toSafeObject() },
    201,
  );
});

// POST /auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const errors = {};
  if (!email && !username) {
    errors.username = "Username or email is required.";
    errors.email = "Username or email is required.";
  }
  if (!password) {
    errors.password = "Password is required.";
  }
  if (Object.keys(errors).length) {
    throw new ApiError(422, "Validation Error", errors);
  }

  const field = email ? "email" : "username";
  const query = email
    ? { email: email.toLowerCase() }
    : { username: username.toLowerCase() };

  const user = await User.findOne(query).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid login credentials.", {
      [field]: `No account found with this ${field}.`,
    });
  }

  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid login credentials.", {
      password: "The password you entered is incorrect.",
    });
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Your account has been disabled.", {
      account: "This account has been disabled. Contact support.",
    });
  }

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
  await user.save({ validateBeforeSave: false });

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
  await user.save({ validateBeforeSave: false });

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
  await user.save({ validateBeforeSave: false });

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
  await user.save({ validateBeforeSave: false });
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
  await user.save({ validateBeforeSave: false });
  return success(res, "Password changed successfully.");
});

// POST /auth/logout
exports.logout = asyncHandler(async (req, res) => {
  // JWTs are stateless; the client is responsible for discarding the token.
  // (Add a token-blacklist collection here if server-side invalidation is required.)
  return success(res, "Logged out successfully.");
});
