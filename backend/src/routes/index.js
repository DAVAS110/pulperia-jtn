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

// TREASURY
router.get("/treasury", authenticate, treasury.getSummary);
router.get("/treasury/movements", authenticate, treasury.listMovements);
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

// REPORTS
router.get("/reports/dashboard", authenticate, reports.dashboard);
router.get("/reports/sales", authenticate, reports.salesReport);
router.get(
  "/reports/inventory",
  authenticate,
  requireAdmin,
  reports.inventoryReport,
);
router.get("/reports/daily", authenticate, daily.dailyReport);
router.post("/reports/send-email", authenticate, daily.sendEmail);

module.exports = router;
