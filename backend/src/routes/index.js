const router = require("express").Router();
const { authenticate, requireAdmin } = require("../middleware/auth");
const { loginLimiter, writeLimiter } = require("../middleware/rateLimit");
const {
  validateLogin,
  validateCreateUser,
  validateTreasuryMovement,
  validateDebtPayment,
} = require("../middleware/validation");
const auth = require("../controllers/auth.controller");
const categories = require("../controllers/categories.controller");
const products = require("../controllers/products.controller");
const inventory = require("../controllers/inventory.controller");
const sales = require("../controllers/sales.controller");
const reports = require("../controllers/reports.controller");
const treasury = require("../controllers/treasury.controller");
const daily = require("../controllers/dailyReport.controller");
const combos = require("../controllers/combos.controller");
const image = require("../controllers/image.controller");
const debts = require("../controllers/debts.controller");
const shifts = require("../controllers/shifts.controller");

// AUTH
router.post("/auth/login", loginLimiter, validateLogin, auth.login);
router.post("/auth/logout", authenticate, writeLimiter, auth.logout);
router.get("/auth/me", authenticate, auth.me);
router.get("/auth/users", authenticate, requireAdmin, auth.listUsers);
router.post(
  "/auth/users",
  authenticate,
  requireAdmin,
  writeLimiter,
  validateCreateUser,
  auth.createUser,
);
router.patch("/auth/users/:id", authenticate, requireAdmin, auth.updateUser);
router.delete("/auth/users/:id", authenticate, requireAdmin, auth.deleteUser);

// CATEGORIES
router.get("/categories", authenticate, categories.list);
router.post("/categories", authenticate, requireAdmin, categories.create);
router.put("/categories/:id", authenticate, requireAdmin, categories.update);
router.delete("/categories/:id", authenticate, requireAdmin, categories.remove);

// PRODUCTS
router.get("/products", authenticate, products.list);
router.get("/products/sku/:sku", authenticate, products.getBySku);
router.get("/products/:id", authenticate, products.getOne);
router.post("/products", authenticate, writeLimiter, products.create);
router.put("/products/:id", authenticate, products.update);
router.delete("/products/:id", authenticate, requireAdmin, products.remove);

// COMBOS
router.get("/combos", authenticate, combos.list);
router.get("/combos/all", authenticate, requireAdmin, combos.listAll);
router.post("/combos", authenticate, requireAdmin, combos.create);
router.put("/combos/:id", authenticate, requireAdmin, combos.update);
router.delete("/combos/:id", authenticate, requireAdmin, combos.remove);

// INVENTORY
router.get("/inventory", authenticate, inventory.list);
router.post("/inventory", authenticate, inventory.create);

// SALES
router.get("/sales", authenticate, sales.list);
router.post("/sales", authenticate, sales.create);
router.delete("/sales/:id", authenticate, requireAdmin, sales.cancel);

// DEBTS (pendientes / fiado)
router.get("/debts", authenticate, debts.list);
router.post(
  "/debts/:id/pay",
  authenticate,
  writeLimiter,
  validateDebtPayment,
  debts.pay,
);

// TREASURY (admin only — datos financieros sensibles)
router.get("/treasury", authenticate, requireAdmin, treasury.getSummary);
router.get(
  "/treasury/movements",
  authenticate,
  requireAdmin,
  treasury.listMovements,
);
router.post(
  "/treasury/withdraw",
  authenticate,
  requireAdmin,
  writeLimiter,
  validateTreasuryMovement,
  treasury.withdraw,
);
router.post(
  "/treasury/deposit",
  authenticate,
  requireAdmin,
  writeLimiter,
  validateTreasuryMovement,
  treasury.deposit,
);

// SHIFTS (horarios de empleados) — todos ven, solo admin edita
router.get("/shifts", authenticate, shifts.list);
router.get("/shifts/summary", authenticate, shifts.summary);
router.post("/shifts", authenticate, requireAdmin, writeLimiter, shifts.create);
router.put("/shifts/:id", authenticate, requireAdmin, shifts.update);
router.delete("/shifts/:id", authenticate, requireAdmin, shifts.remove);

// REPORTS
router.get("/reports/dashboard", authenticate, reports.dashboard);
// Cierre de caja incluye saldos de tesorería — admin only
router.get("/reports/daily", authenticate, requireAdmin, daily.dailyReport);
router.post(
  "/reports/send-email",
  authenticate,
  requireAdmin,
  daily.sendEmail,
);

module.exports = router;
