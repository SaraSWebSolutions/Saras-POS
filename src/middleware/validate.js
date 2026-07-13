const { validationResult } = require("express-validator");

// Run after express-validator chains; converts failures into the standard error shape
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  result.array().forEach((e) => {
    errors[e.path] = e.msg;
  });

  return res.status(422).json({
    status: false,
    message: "Validation Error",
    errors,
  });
};
