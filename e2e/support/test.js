// `test` de Playwright con utilidades comunes:
//  - cada prueba usa una IP distinta hacia /api (X-Forwarded-For) para no agotar el rate limit
//  - helpers para iniciar sesión por API y para leer/crear datos de apoyo
const base = require("@playwright/test");
const qa = require("../../backend/tests/qa/helpers");
const loadFixture = require("./fixture");

const rnd = (n) => Math.floor(Math.random() * n);
const API = "http://localhost:3001"; // acceso directo para preparar datos

const test = base.test.extend({
  ip: async ({}, use) => use(`10.${rnd(250)}.${rnd(250)}.${rnd(250)}`),
  page: async ({ page, ip }, use) => {
    await page.route("**/api/**", (route) =>
      route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
    );
    await use(page);
  },
  fx: async ({}, use) => use(loadFixture()),
});

// Inicia sesión sin pasar por el formulario (la cookie queda en el contexto del navegador).
async function loginAs(page, role, fx, ip) {
  const user = role === "admin" ? fx.adminUser : fx.empUser;
  const r = await page.request.post("/api/auth/login", {
    data: { email: user.email, password: fx.password },
    headers: { "x-forwarded-for": ip },
  });
  if (!r.ok()) throw new Error(`login ${role} falló: ${r.status()}`);
}

// Cliente HTTP directo al backend para preparar datos (ventas, fiados…) como un usuario QA.
async function apiClient(fx, role = "admin") {
  const c = qa.makeClient(API);
  const user = role === "admin" ? fx.adminUser : fx.empUser;
  const r = await c.login(user.email, fx.password);
  if (r.status !== 200) throw new Error(`login API ${role}: ${r.status}`);
  return c;
}

// Crea un fiado por API y devuelve { saleId, debtId }.
async function createFiado(client, items, name, phone = null) {
  const r = await client.post("/api/sales", {
    items: items.map(([p, q]) => ({ product_id: p.id, quantity: q })),
    combos: [],
    payment_method: "fiado",
    customer_name: name,
    customer_phone: phone,
  });
  if (r.status !== 201) throw new Error(`crear fiado: ${r.status} ${JSON.stringify(r.data)}`);
  const { rows } = await qa.pool.query("SELECT id FROM debts WHERE sale_id = $1", [r.data.sale.id]);
  return { saleId: r.data.sale.id, debtId: rows[0].id };
}

module.exports = {
  test,
  expect: base.expect,
  loginAs,
  apiClient,
  createFiado,
  qa,
};
