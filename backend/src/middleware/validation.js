const { body, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation error",
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const validateLogin = [
  body("email").isEmail().withMessage("Email inválido").trim(),
  body("password")
    .isLength({ min: 1, max: 128 })
    .withMessage("Password requerido o demasiado largo"),
  handleValidationErrors,
];

const validateCreateUser = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nombre debe tener 2 a 100 caracteres"),
  body("email").isEmail().withMessage("Email inválido").trim(),
  body("password")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password debe tener 6 a 128 caracteres"),
  body("role")
    .optional()
    .isIn(["admin", "employee"])
    .withMessage("Rol inválido"),
  handleValidationErrors,
];

const validateTreasuryMovement = [
  body("account_type")
    .isIn(["caja", "sinpe"])
    .withMessage("account_type inválido"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("amount debe ser mayor a 0"),
  body("category")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("category inválido"),
  handleValidationErrors,
];

const validateDebtPayment = [
  body("payment_method")
    .isIn(["efectivo", "sinpe"])
    .withMessage("payment_method inválido"),
  body("cash_received").optional({ nullable: true }).isFloat({ min: 0 }),
  body("sinpe_description").optional({ nullable: true }).trim().isLength({ max: 300 }),
  body("received_by").optional({ nullable: true }).trim().isLength({ max: 150 }),
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateCreateUser,
  validateTreasuryMovement,
  validateDebtPayment,
};
