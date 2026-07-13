/**
 * Standard response helpers - matches the Saras POS response contract:
 * Success -> { status: true, message, data }
 * Validation/Error -> { status: false, message, errors }
 */

exports.success = (res, message = "Success", data = {}, code = 200) => {
  return res.status(code).json({
    status: true,
    message,
    data,
  });
};

exports.error = (
  res,
  message = "Something went wrong",
  code = 500,
  errors = {},
) => {
  return res.status(code).json({
    status: false,
    message,
    errors,
  });
};
