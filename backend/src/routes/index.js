const router = require("express").Router();
const { authenticate, requireAdmin } = require("../middleware/auth");
const auth = require("../controllers/auth.controller");
const categories = require("../controllers/categories.controller");
const products = require("../controllers/products.controller");
const inventory = require("../controllers/inventory.controller");
const sales = require("../controllers/sales.controller");
const reports = require("../controllers/reports.controller");
const treasury = require("../controllers/treasury.controller");
const daily = require("../controllers/dailyReport.controller");

// AUTH
router.post("/auth/login", auth.login);
router.get("/auth/me", authenticate, auth.me);
router.get("/auth/users", authenticate, requireAdmin, auth.listUsers);
router.post("/auth/users", authenticate, requireAdmin, auth.createUser);
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
router.post("/products", authenticate, products.create);
router.put("/products/:id", authenticate, products.update);
router.delete("/products/:id", authenticate, requireAdmin, products.remove);

// INVENTORY
router.get("/inventory", authenticate, inventory.list);
router.post("/inventory", authenticate, inventory.create);

// SALES
router.get("/sales", authenticate, sales.list);
router.post("/sales", authenticate, sales.create);
router.delete("/sales/:id", authenticate, requireAdmin, sales.cancel);

// TREASURY
router.get("/treasury", authenticate, treasury.getSummary);
router.get("/treasury/movements", authenticate, treasury.listMovements);
router.post(
  "/treasury/withdraw",
  authenticate,
  requireAdmin,
  treasury.withdraw,
);
router.post("/treasury/deposit", authenticate, requireAdmin, treasury.deposit);

// REPORTS
router.get("/reports/dashboard", authenticate, reports.dashboard);
router.get("/reports/sales", authenticate, reports.salesReport);
router.get("/reports/inventory", authenticate, reports.inventoryReport);
router.get("/reports/daily", authenticate, daily.dailyReport);
router.post("/reports/send-email", authenticate, daily.sendEmail);

module.exports = router;
