// TC-PRO-01 … 08, TC-INV-01 … 05, TC-TRE-01 … 04 — ver tests/QA_TEST_CASES.md
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("./helpers");

let ctx;
before(async () => {
  ctx = await qa.setup(3102);
});
after(async () => {
  await qa.teardown(ctx);
});

// ───────────── PRODUCTOS ─────────────
test("TC-PRO-01 crear producto con stock inicial registra el movimiento", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10 });
  assert.equal(await qa.stockOf(p.id), 10);
  const mv = await qa.movements(p.id);
  assert.equal(mv.length, 1);
  assert.deepEqual([mv[0].type, mv[0].quantity, mv[0].reason], ["entrada", 10, "Stock inicial"]);
});

test("TC-PRO-02 SKU duplicado: 409", async () => {
  const p = await qa.mkProduct(ctx);
  const r = await ctx.admin.post("/api/products", { name: "Duplicado", sku: p.sku, sale_price: 100 });
  assert.equal(r.status, 409);
});

test("TC-PRO-03 precio negativo: 400", async () => {
  const r = await ctx.admin.post("/api/products", {
    name: "Precio malo",
    sku: `QA${ctx.tag}-NEG`,
    sale_price: -5,
  });
  assert.equal(r.status, 400);
});

test("TC-PRO-04 el empleado no ve cost_price", async () => {
  const p = await qa.mkProduct(ctx, { cost: 777 });
  const adminView = await ctx.admin.get(`/api/products/${p.id}`);
  assert.ok(adminView.data.product.cost_price !== undefined, "el admin sí ve el costo");
  const detail = await ctx.emp.get(`/api/products/${p.id}`);
  assert.equal(detail.status, 200);
  assert.equal("cost_price" in detail.data.product, false);
  const list = await ctx.emp.get(`/api/products?search=${p.sku}`);
  assert.equal(list.status, 200);
  assert.ok(list.data.products.length >= 1);
  assert.equal(list.data.products.some((x) => "cost_price" in x), false);
});

test("TC-PRO-05 paginación acotada: limit enorme y page negativa", async () => {
  const r = await ctx.admin.get("/api/products?limit=99999&page=-3");
  assert.equal(r.status, 200);
  assert.ok(r.data.limit <= 500, `limit devuelto: ${r.data.limit}`);
});

test("TC-PRO-06 la búsqueda encuentra el producto por SKU", async () => {
  const p = await qa.mkProduct(ctx);
  const r = await ctx.admin.get(`/api/products?search=${encodeURIComponent(p.sku)}`);
  assert.equal(r.status, 200);
  assert.ok(r.data.products.some((x) => x.id === p.id));
});

test("TC-PRO-07 búsqueda con inyección SQL no rompe ni devuelve todo", async () => {
  await qa.mkProduct(ctx);
  const total = (await ctx.admin.get("/api/products?limit=1")).data.total;
  const r = await ctx.admin.get(`/api/products?search=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(r.status, 200);
  assert.ok(r.data.total < total || total === 0, "no debe devolver todo el catálogo");
});

test("TC-PRO-08 producto eliminado no se puede vender", async () => {
  const p = await qa.mkProduct(ctx, { stock: 5 });
  assert.equal((await ctx.admin.del(`/api/products/${p.id}`)).status, 200);
  const sale = await ctx.admin.post("/api/sales", {
    items: [{ product_id: p.id, quantity: 1 }],
    payment_method: "efectivo",
  });
  assert.equal(sale.status, 400);
  assert.equal(await qa.stockOf(p.id), 5);
});

// ───────────── INVENTARIO ─────────────
test("TC-INV-01 entrada suma stock y registra el movimiento", async () => {
  const p = await qa.mkProduct(ctx, { stock: 2 });
  const r = await ctx.admin.post("/api/inventory", { product_id: p.id, type: "entrada", quantity: 5, reason: "QA" });
  assert.equal(r.status, 201);
  assert.equal(await qa.stockOf(p.id), 7);
  const mv = await qa.movements(p.id);
  assert.equal(mv[mv.length - 1].type, "entrada");
  assert.equal(mv[mv.length - 1].quantity, 5);
});

test("TC-INV-02 salida resta stock y registra el movimiento", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10 });
  const r = await ctx.admin.post("/api/inventory", { product_id: p.id, type: "salida", quantity: 3 });
  assert.equal(r.status, 201);
  assert.equal(await qa.stockOf(p.id), 7);
  assert.equal((await qa.movements(p.id)).pop().type, "salida");
});

test("TC-INV-03 salida mayor al stock: 400, stock intacto y fila NO bloqueada", async () => {
  const p = await qa.mkProduct(ctx, { stock: 2 });
  const bad = await ctx.admin.post("/api/inventory", { product_id: p.id, type: "salida", quantity: 50 });
  assert.equal(bad.status, 400);
  assert.equal(await qa.stockOf(p.id), 2);

  // Si el 400 dejó una transacción abierta con la fila bloqueada, estas operaciones se cuelgan.
  // varias entradas seguidas: alguna reutiliza la conexión "sucia" del pool
  const run = (async () => {
    for (let i = 0; i < 6; i++) {
      const r = await ctx.admin.post("/api/inventory", { product_id: p.id, type: "entrada", quantity: 1 });
      assert.equal(r.status, 201, `entrada ${i + 1}`);
    }
    return "ok";
  })();
  const timeout = new Promise((resolve) => setTimeout(() => resolve("BLOQUEADO"), 8000));
  const result = await Promise.race([run, timeout]);
  assert.equal(result, "ok", "las entradas posteriores quedaron bloqueadas (fila del producto retenida)");
  assert.equal(await qa.stockOf(p.id), 8);
});

test("TC-INV-04 ajuste fija el stock exacto", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20 });
  const r = await ctx.admin.post("/api/inventory", { product_id: p.id, type: "ajuste", quantity: 7 });
  assert.equal(r.status, 201);
  assert.equal(await qa.stockOf(p.id), 7);
});

test("TC-INV-05 cantidad 0 o negativa: 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 4 });
  assert.equal((await ctx.admin.post("/api/inventory", { product_id: p.id, type: "entrada", quantity: 0 })).status, 400);
  assert.equal((await ctx.admin.post("/api/inventory", { product_id: p.id, type: "entrada", quantity: -2 })).status, 400);
  assert.equal(await qa.stockOf(p.id), 4);
});

// ───────────── TESORERÍA ─────────────
test("TC-TRE-01 depósito y retiro mueven el saldo y dejan movimientos", async () => {
  const before = await qa.balances();
  const dep = await ctx.admin.post("/api/treasury/deposit", { account_type: "caja", amount: 1000, category: "qa" });
  assert.equal(dep.status, 201);
  const wd = await ctx.admin.post("/api/treasury/withdraw", { account_type: "caja", amount: 400, category: "qa" });
  assert.equal(wd.status, 201);
  const after = await qa.balances();
  assert.equal(after.caja, before.caja + 600);
  const { rows } = await qa.pool.query(
    "SELECT direction, amount FROM treasury_movements WHERE user_id = $1 AND category = 'qa' ORDER BY created_at",
    [ctx.adminUser.id],
  );
  assert.deepEqual(rows.map((r) => [r.direction, parseFloat(r.amount)]), [["entrada", 1000], ["salida", 400]]);
});

test("TC-TRE-02 retiro mayor al saldo: 400 y saldo intacto", async () => {
  const before = await qa.balances();
  const r = await ctx.admin.post("/api/treasury/withdraw", {
    account_type: "sinpe",
    amount: before.sinpe + 1000000,
    category: "qa",
  });
  assert.equal(r.status, 400);
  assert.equal((await qa.balances()).sinpe, before.sinpe);
});

test("TC-TRE-03 montos 0 y negativos: 400", async () => {
  const before = await qa.balances();
  for (const amount of [0, -5]) {
    assert.equal((await ctx.admin.post("/api/treasury/deposit", { account_type: "caja", amount, category: "qa" })).status, 400, `deposit ${amount}`);
    assert.equal((await ctx.admin.post("/api/treasury/withdraw", { account_type: "caja", amount, category: "qa" })).status, 400, `withdraw ${amount}`);
  }
  assert.deepEqual(await qa.balances(), before);
});

test("TC-TRE-04 el empleado no puede operar tesorería: 403", async () => {
  const before = await qa.balances();
  const r = await ctx.emp.post("/api/treasury/deposit", { account_type: "caja", amount: 500, category: "qa" });
  assert.equal(r.status, 403);
  assert.deepEqual(await qa.balances(), before);
});
