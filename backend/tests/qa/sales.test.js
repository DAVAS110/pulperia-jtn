// TC-SAL-01 … 12 — ver tests/QA_TEST_CASES.md
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("./helpers");

let ctx;
before(async () => {
  ctx = await qa.setup(3103);
});
after(async () => {
  await qa.teardown(ctx);
});

const sell = (client, items, extra = {}) =>
  client.post("/api/sales", { items, combos: [], payment_method: "efectivo", ...extra });

test("TC-SAL-01 venta en efectivo: stock, movimiento, Caja, estado y vuelto", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b0 = await qa.balances();
  const r = await sell(ctx.emp, [{ product_id: p.id, quantity: 3 }], { cash_received: 5000 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(parseFloat(r.data.sale.total), 3000);
  assert.equal(r.data.sale.status, "completada");
  assert.equal(parseFloat(r.data.sale.change_given), 2000);
  assert.equal(await qa.stockOf(p.id), 7);
  const mv = (await qa.movements(p.id)).pop();
  assert.deepEqual([mv.type, mv.quantity], ["venta", 3]);
  const b1 = await qa.balances();
  assert.equal(b1.caja, b0.caja + 3000);
  assert.equal(b1.sinpe, b0.sinpe);
});

test("TC-SAL-02 venta por SINPE: con received_by suma a SINPE; sin él, 400 sin efectos", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 500 });
  const b0 = await qa.balances();

  const bad = await sell(ctx.emp, [{ product_id: p.id, quantity: 2 }], { payment_method: "sinpe" });
  assert.equal(bad.status, 400);
  assert.equal(await qa.stockOf(p.id), 10);
  assert.deepEqual(await qa.balances(), b0);

  const ok = await sell(ctx.emp, [{ product_id: p.id, quantity: 2 }], {
    payment_method: "sinpe",
    received_by: "QA Receptor",
    sinpe_description: "pago de prueba",
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(await qa.stockOf(p.id), 8);
  const b1 = await qa.balances();
  assert.equal(b1.sinpe, b0.sinpe + 1000);
  assert.equal(b1.caja, b0.caja);
});

test("TC-SAL-03 stock insuficiente es atómico: ningún producto ni tesorería cambia", async () => {
  const a = await qa.mkProduct(ctx, { stock: 5, price: 100 });
  const b = await qa.mkProduct(ctx, { stock: 1, price: 100 });
  const b0 = await qa.balances();
  const r = await sell(ctx.emp, [
    { product_id: a.id, quantity: 2 },
    { product_id: b.id, quantity: 3 },
  ]);
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(a.id), 5, "el primer producto no debe descontarse");
  assert.equal(await qa.stockOf(b.id), 1);
  assert.deepEqual(await qa.balances(), b0);
  const { rows } = await qa.pool.query("SELECT count(*)::int AS n FROM sale_items WHERE product_id = ANY($1::uuid[])", [[a.id, b.id]]);
  assert.equal(rows[0].n, 0, "no debe quedar ninguna venta");
});

test("TC-SAL-04 efectivo recibido menor al total: 400 sin efectos", async () => {
  const p = await qa.mkProduct(ctx, { stock: 5, price: 1000 });
  const b0 = await qa.balances();
  const r = await sell(ctx.emp, [{ product_id: p.id, quantity: 1 }], { cash_received: 100 });
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(p.id), 5);
  assert.deepEqual(await qa.balances(), b0);
});

test("TC-SAL-05 venta vacía o sin método de pago: 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 5 });
  assert.equal((await ctx.emp.post("/api/sales", { items: [], combos: [], payment_method: "efectivo" })).status, 400);
  assert.equal((await ctx.emp.post("/api/sales", { items: [{ product_id: p.id, quantity: 1 }], combos: [] })).status, 400);
  assert.equal(await qa.stockOf(p.id), 5);
});

test("TC-SAL-06 combo: descuenta cada componente y suma el precio del combo", async () => {
  const a = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b = await qa.mkProduct(ctx, { stock: 10, price: 500 });
  const combo = await qa.mkCombo(ctx, [[a, 1], [b, 2]], 2500);
  const b0 = await qa.balances();
  const r = await ctx.emp.post("/api/sales", {
    items: [],
    combos: [{ combo_id: combo.id, quantity: 2 }],
    payment_method: "efectivo",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(await qa.stockOf(a.id), 8);
  assert.equal(await qa.stockOf(b.id), 6);
  assert.equal((await qa.balances()).caja, b0.caja + 5000);
});

test("TC-SAL-07 combo con un componente sin stock: 400 y nada cambia", async () => {
  const a = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b = await qa.mkProduct(ctx, { stock: 3, price: 500 });
  const combo = await qa.mkCombo(ctx, [[a, 1], [b, 2]], 2500);
  const b0 = await qa.balances();
  const r = await ctx.emp.post("/api/sales", {
    items: [],
    combos: [{ combo_id: combo.id, quantity: 2 }], // necesita 4 de b, hay 3
    payment_method: "efectivo",
  });
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(a.id), 10);
  assert.equal(await qa.stockOf(b.id), 3);
  assert.deepEqual(await qa.balances(), b0);
});

test("TC-SAL-08 anular venta: restituye stock, revierte Caja y una segunda anulación da 404", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b0 = await qa.balances();
  const sale = await sell(ctx.emp, [{ product_id: p.id, quantity: 4 }]);
  assert.equal(sale.status, 201);
  assert.equal(await qa.stockOf(p.id), 6);

  const cancel = await ctx.admin.del(`/api/sales/${sale.data.sale.id}`);
  assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
  assert.equal(await qa.stockOf(p.id), 10);
  const mv = (await qa.movements(p.id)).pop();
  assert.deepEqual([mv.type, mv.quantity, mv.reason], ["entrada", 4, "Anulación de venta"]);
  assert.deepEqual(await qa.balances(), b0);
  const { rows } = await qa.pool.query("SELECT status FROM sales WHERE id = $1", [sale.data.sale.id]);
  assert.equal(rows[0].status, "anulada");

  assert.equal((await ctx.admin.del(`/api/sales/${sale.data.sale.id}`)).status, 404);
  assert.equal(await qa.stockOf(p.id), 10, "la segunda anulación no debe devolver stock otra vez");
});

test("TC-SAL-09 el empleado no puede anular ventas: 403", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10 });
  const sale = await sell(ctx.emp, [{ product_id: p.id, quantity: 2 }]);
  const r = await ctx.emp.del(`/api/sales/${sale.data.sale.id}`);
  assert.equal(r.status, 403);
  assert.equal(await qa.stockOf(p.id), 8);
});

test("TC-SAL-10 concurrencia sobre la última unidad: 1 éxito, 1 error, stock 0", async () => {
  const p = await qa.mkProduct(ctx, { stock: 1, price: 800 });
  const results = await Promise.all([
    sell(ctx.emp, [{ product_id: p.id, quantity: 1 }]),
    sell(ctx.admin, [{ product_id: p.id, quantity: 1 }]),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 400]);
  assert.equal(await qa.stockOf(p.id), 0, "el stock nunca debe quedar negativo");
});

test("TC-SAL-11 anular una venta fiada ya cobrada en efectivo revierte Caja (no SINPE)", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b0 = await qa.balances();
  const sale = await ctx.emp.post("/api/sales", {
    items: [{ product_id: p.id, quantity: 2 }],
    combos: [],
    payment_method: "fiado",
    customer_name: `QA Cliente ${ctx.tag}`,
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.data));
  const { rows } = await qa.pool.query("SELECT id FROM debts WHERE sale_id = $1", [sale.data.sale.id]);
  const pay = await ctx.admin.post(`/api/debts/${rows[0].id}/pay`, { payment_method: "efectivo", cash_received: 2000 });
  assert.equal(pay.status, 200);
  assert.equal((await qa.balances()).caja, b0.caja + 2000);

  const cancel = await ctx.admin.del(`/api/sales/${sale.data.sale.id}`);
  assert.equal(cancel.status, 200);
  const b2 = await qa.balances();
  assert.equal(b2.caja, b0.caja, "debe revertirse Caja, que fue donde entró el dinero");
  assert.equal(b2.sinpe, b0.sinpe, "SINPE no debe tocarse");
  assert.equal(await qa.stockOf(p.id), 10);
});

test("TC-SAL-12 listado de ventas con limit enorme responde acotado", async () => {
  const r = await ctx.admin.get("/api/sales?limit=99999&page=-1");
  assert.equal(r.status, 200);
  assert.ok(r.data.sales.length <= 500);
});
