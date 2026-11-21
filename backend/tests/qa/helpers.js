// Utilidades de la suite QA: arranca un backend propio, crea datos con prefijo QA
// y los limpia al terminar. Solo corre contra una base de datos LOCAL.
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { pool } = require("../../src/config/database");
const bcrypt = require("bcryptjs");

const SAFE_HOSTS = ["localhost", "127.0.0.1", "::1", "db", "postgres", "host.docker.internal"];

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL || "";
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    throw new Error("DATABASE_URL inválida: la suite QA no se ejecuta");
  }
  if (process.env.NODE_ENV === "production" || !SAFE_HOSTS.includes(host)) {
    throw new Error(
      `La suite QA solo corre contra una base local. Host detectado: "${host}". ` +
        "Se cancela para no tocar producción.",
    );
  }
}

const rnd = (n) => Math.floor(Math.random() * n);
const randomIp = () => `10.${rnd(250)}.${rnd(250)}.${rnd(250)}`;

// Cliente HTTP con cookie propia. Cada petición usa una IP distinta (X-Forwarded-For)
// para no chocar con el rate limit, salvo que se indique `ip`.
function makeClient(base) {
  let cookie = "";
  const req = async (method, url, body, opts = {}) => {
    const headers = {
      "X-Forwarded-For": opts.ip || randomIp(),
      ...(body !== undefined && !opts.raw ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(base + url, {
      method,
      headers,
      body: body === undefined ? undefined : opts.raw ? body : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  };
  return {
    req,
    get: (u, o) => req("GET", u, undefined, o),
    post: (u, b, o) => req("POST", u, b, o),
    put: (u, b, o) => req("PUT", u, b, o),
    patch: (u, b, o) => req("PATCH", u, b, o),
    del: (u, o) => req("DELETE", u, undefined, o),
    login: (email, password, o) => req("POST", "/api/auth/login", { email, password }, o),
    clearCookie: () => (cookie = ""),
  };
}

async function waitForHealth(base, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(base + "/health");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("El backend de pruebas no arrancó a tiempo");
}

async function balances() {
  const { rows } = await pool.query("SELECT type, balance FROM treasury_accounts");
  const out = {};
  for (const r of rows) out[r.type] = parseFloat(r.balance);
  return out;
}

// Datos base sin servidor: etiqueta única, saldos iniciales y usuarios admin/empleado.
async function createBaseFixture() {
  assertLocalDatabase();
  const tag = crypto.randomBytes(3).toString("hex").toUpperCase(); // ej. A1B2C3
  const snapshot = await balances();
  const password = "Qa-test-123";
  const hash = await bcrypt.hash(password, 4);
  const mkUser = async (role) => {
    const email = `qa.${role}.${tag.toLowerCase()}@qa.test`;
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1,$2,$3,$4,true) RETURNING id, email`,
      [`QA ${role} ${tag}`, email, hash, role],
    );
    return { id: rows[0].id, email };
  };
  const adminUser = await mkUser("admin");
  const empUser = await mkUser("employee");
  return {
    tag,
    password,
    snapshot,
    adminUser,
    empUser,
    skuCount: 0,
    extraUserIds: [],
    comboPrefix: `QA ${tag}`,
    server: null,
    logs: [],
  };
}

async function setup(port) {
  const ctx = await createBaseFixture();
  const base = `http://127.0.0.1:${port}`;

  const server = spawn(process.execPath, ["src/index.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      FRONTEND_URL: "http://localhost:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => ctx.logs.push(String(d)));
  server.stderr.on("data", (d) => ctx.logs.push(String(d)));
  await waitForHealth(base);

  const admin = makeClient(base);
  const emp = makeClient(base);
  const anon = makeClient(base);
  const r1 = await admin.login(ctx.adminUser.email, ctx.password);
  const r2 = await emp.login(ctx.empUser.email, ctx.password);
  if (r1.status !== 200 || r2.status !== 200) throw new Error("No se pudo iniciar sesión con los usuarios QA");

  Object.assign(ctx, { base, port, server, admin, emp, anon });
  return ctx;
}

// Crea un producto por la API (prueba de paso la creación). Devuelve { id, sku, name }.
async function mkProduct(ctx, { stock = 10, price = 1000, cost = 500, name } = {}) {
  ctx.skuCount += 1;
  const sku = `QA${ctx.tag}-${ctx.skuCount}`;
  const body = {
    name: name || `QA Producto ${ctx.tag}-${ctx.skuCount}`,
    sku,
    sale_price: price,
    cost_price: cost,
    stock,
    min_stock: 1,
  };
  const r = await ctx.admin.post("/api/products", body);
  if (r.status !== 201) throw new Error(`No se pudo crear producto QA: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: r.data.product.id, sku: r.data.product.sku, name: body.name, price };
}

async function mkCombo(ctx, products, price) {
  const r = await ctx.admin.post("/api/combos", {
    name: `${ctx.comboPrefix} combo ${Date.now()}`,
    price,
    items: products.map(([p, q]) => ({ product_id: p.id, quantity: q })),
  });
  if (r.status !== 201) throw new Error(`No se pudo crear combo QA: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.combo;
}

async function stockOf(productId) {
  const { rows } = await pool.query("SELECT stock FROM products WHERE id = $1", [productId]);
  return rows[0] ? rows[0].stock : null;
}

async function movements(productId) {
  const { rows } = await pool.query(
    "SELECT type, quantity, reason FROM inventory_movements WHERE product_id = $1 ORDER BY created_at, id",
    [productId],
  );
  return rows;
}

async function teardown(ctx) {
  if (!ctx) return;
  try {
    if (ctx.server && !ctx.server.killed) ctx.server.kill();
  } catch {}
  try {
    const pat = `QA${ctx.tag}-%`;
    const prod = await pool.query("SELECT id FROM products WHERE sku LIKE $1", [pat]);
    const productIds = prod.rows.map((r) => r.id);
    const sales = await pool.query(
      "SELECT DISTINCT sale_id FROM sale_items WHERE product_id = ANY($1::uuid[])",
      [productIds],
    );
    const saleIds = sales.rows.map((r) => r.sale_id);
    const userIds = [ctx.adminUser.id, ctx.empUser.id, ...ctx.extraUserIds];
    const emails = await pool.query("SELECT id FROM users WHERE email LIKE $1", [`%${ctx.tag.toLowerCase()}@qa.test`]);
    for (const u of emails.rows) if (!userIds.includes(u.id)) userIds.push(u.id);

    await pool.query(
      "DELETE FROM treasury_movements WHERE reference_sale_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])",
      [saleIds, userIds],
    );
    await pool.query("DELETE FROM debts WHERE sale_id = ANY($1::uuid[])", [saleIds]);
    await pool.query("DELETE FROM sale_items WHERE sale_id = ANY($1::uuid[])", [saleIds]);
    await pool.query("DELETE FROM sales WHERE id = ANY($1::uuid[])", [saleIds]);
    await pool.query("DELETE FROM inventory_movements WHERE product_id = ANY($1::uuid[])", [productIds]);
    const combos = await pool.query("SELECT id FROM combos WHERE name LIKE $1", [`${ctx.comboPrefix}%`]);
    const comboIds = combos.rows.map((r) => r.id);
    await pool.query("DELETE FROM combo_items WHERE combo_id = ANY($1::uuid[])", [comboIds]);
    await pool.query("DELETE FROM combos WHERE id = ANY($1::uuid[])", [comboIds]);
    await pool.query("DELETE FROM products WHERE id = ANY($1::uuid[])", [productIds]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    for (const [type, balance] of Object.entries(ctx.snapshot)) {
      await pool.query("UPDATE treasury_accounts SET balance = $1 WHERE type = $2", [balance, type]);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

module.exports = {
  assertLocalDatabase,
  createBaseFixture,
  setup,
  teardown,
  mkProduct,
  mkCombo,
  stockOf,
  movements,
  balances,
  makeClient,
  pool,
  randomIp,
};
