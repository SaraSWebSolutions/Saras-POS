const ApiError = require("../utils/ApiError");

exports.notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || {};

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 422;
    message = "Validation Error";
    errors = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 422;
    message = "Validation Error";
    const field = Object.keys(err.keyValue || {})[0];
    errors = { [field]: `${field} already exists` };
  }

  // Mongoose invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 404;
    message = `Resource not found for id: ${err.value}`;
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    status: false,
    message,
    errors,
  });
};
