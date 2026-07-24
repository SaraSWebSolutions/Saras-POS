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
    phone,
    gstNumber,
  } = req.body;

  const missing = [];
  if (!username) missing.push("username");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
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

   // gstNumber is optional, but if provided it must look like a valid GSTIN
  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
  if (gstNumber && !GSTIN_REGEX.test(gstNumber.trim().toUpperCase())) {
    throw new ApiError(422, "Validation Error", {
      gstNumber: "Please enter a valid GST number.",
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
    phone,
    gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : "",
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

// GET /auth/terms-and-conditions
exports.getTerms = asyncHandler(async (req, res) => {
  // NOTE: placeholder/dummy content - replace with your real legal copy
  const terms = {
    version: "1.0",
    effectiveDate: "2026-01-01",
    title: "Terms & Conditions",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body:
          "By registering for and using this service, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the service.",
      },
      {
        heading: "2. Account Registration",
        body:
          "You must provide accurate, current, and complete information during registration, including your business name, contact details, and any tax identifiers such as GST number where applicable, and keep this information up to date.",
      },
      {
        heading: "3. Use of Service",
        body:
          "You agree to use the service only for lawful purposes and in accordance with all applicable local, state, and national laws and regulations.",
      },
      {
        heading: "4. Privacy",
        body:
          "Your use of the service is also governed by our Privacy Policy, which describes how we collect, use, and protect your information.",
      },
      {
        heading: "5. Termination",
        body:
          "We reserve the right to suspend or terminate your account if you violate these Terms & Conditions or engage in fraudulent or abusive activity.",
      },
      {
        heading: "6. Changes to Terms",
        body:
          "We may update these Terms & Conditions from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.",
      },
      {
        heading: "7. Limitation of Liability",
        body:
          "The service is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
      },
      {
        heading: "8. Contact",
        body:
          "For questions about these Terms & Conditions, please contact our support team.",
      },
    ],
  };

  return success(res, "Terms & conditions fetched", { terms });
});

// POST /auth/logout
exports.logout = asyncHandler(async (req, res) => {
  // JWTs are stateless; the client is responsible for discarding the token.
  // (Add a token-blacklist collection here if server-side invalidation is required.)
  return success(res, "Logged out successfully.");
});