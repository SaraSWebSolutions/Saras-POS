const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

// Verifies the Bearer token and attaches req.user
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) {
    throw new ApiError(401, "Unauthorized. Token not provided.");
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, "Unauthorized. Invalid or expired token.");
  }

  const user = await User.findById(decoded.id);
  if (!user || user.status !== "active") {
    throw new ApiError(401, "Unauthorized. User not found or inactive.");
  }

  req.user = user;
  next();
});

// Restricts route to specific roles, e.g. authorize("admin")
exports.authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        "Forbidden. You do not have permission to perform this action.",
      );
    }
    next();
  };
