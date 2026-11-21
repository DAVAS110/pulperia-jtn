// TC-DEB-01 … 12 y TC-EDT-01 … 13 — ver tests/QA_TEST_CASES.md
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("./helpers");

let ctx;
before(async () => {
  ctx = await qa.setup(3104);
});
after(async () => {
  await qa.teardown(ctx);
});

// Crea un fiado y devuelve { saleId, debtId, amount }
async function fiado(client, items, name, phone = null) {
  const r = await client.post("/api/sales", {
    items: items.map(([p, q]) => ({ product_id: p.id, quantity: q })),
    combos: [],
    payment_method: "fiado",
    customer_name: name,
    customer_phone: phone,
  });
  assert.equal(r.status, 201, `crear fiado: ${JSON.stringify(r.data)}`);
  const { rows } = await qa.pool.query("SELECT id, amount FROM debts WHERE sale_id = $1", [r.data.sale.id]);
  return { saleId: r.data.sale.id, debtId: rows[0].id, amount: parseFloat(rows[0].amount) };
}
const debtRow = async (id) =>
  (await qa.pool.query("SELECT status, amount, customer_name, customer_phone FROM debts WHERE id = $1", [id])).rows[0];
const saleRow = async (id) => (await qa.pool.query("SELECT status, total, subtotal FROM sales WHERE id = $1", [id])).rows[0];
const pay = (client, id, body = { payment_method: "efectivo" }) => client.post(`/api/debts/${id}/pay`, body);
const name = (s) => `QA ${s} ${ctx.tag}`;

// ───────────── PENDIENTES ─────────────
test("TC-DEB-01 crear fiado: deuda pendiente, stock baja y tesorería no cambia", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b0 = await qa.balances();
  const d = await fiado(ctx.emp, [[p, 2]], name("Uno"));
  assert.equal(d.amount, 2000);
  assert.equal((await debtRow(d.debtId)).status, "pendiente");
  assert.equal((await saleRow(d.saleId)).status, "pendiente");
  assert.equal(await qa.stockOf(p.id), 8);
  assert.deepEqual(await qa.balances(), b0);
});

test("TC-DEB-02 fiado sin nombre de cliente: 400 sin efectos", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10 });
  const r = await ctx.emp.post("/api/sales", {
    items: [{ product_id: p.id, quantity: 1 }],
    combos: [],
    payment_method: "fiado",
  });
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(p.id), 10);
});

test("TC-DEB-03 cobro individual en efectivo", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 3]], name("Cobro"));
  const b0 = await qa.balances();
  const r = await pay(ctx.emp, d.debtId, { payment_method: "efectivo", cash_received: 5000 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await debtRow(d.debtId)).status, "pagada");
  assert.equal((await saleRow(d.saleId)).status, "completada");
  assert.equal((await qa.balances()).caja, b0.caja + 3000);
  const { rows } = await qa.pool.query(
    "SELECT direction, amount FROM treasury_movements WHERE reference_sale_id = $1 AND category = 'cobro_deuda'",
    [d.saleId],
  );
  assert.equal(rows.length, 1);
  assert.equal(parseFloat(rows[0].amount), 3000);
});

test("TC-DEB-04 efectivo recibido menor al monto: 400 y sigue pendiente", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 2]], name("Corto"));
  const b0 = await qa.balances();
  const r = await pay(ctx.emp, d.debtId, { payment_method: "efectivo", cash_received: 500 });
  assert.equal(r.status, 400);
  assert.equal((await debtRow(d.debtId)).status, "pendiente");
  assert.deepEqual(await qa.balances(), b0);
});

test("TC-DEB-05 cobro por SINPE sin indicar quién recibió: 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Sinpe"));
  const b0 = await qa.balances();
  const bad = await pay(ctx.emp, d.debtId, { payment_method: "sinpe" });
  assert.equal(bad.status, 400);
  assert.equal((await debtRow(d.debtId)).status, "pendiente");
  const ok = await pay(ctx.emp, d.debtId, { payment_method: "sinpe", received_by: "QA Receptor" });
  assert.equal(ok.status, 200);
  assert.equal((await qa.balances()).sinpe, b0.sinpe + 1000);
});

test("TC-DEB-06 doble cobro secuencial: el segundo falla y Caja suma una sola vez", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Doble"));
  const b0 = await qa.balances();
  assert.equal((await pay(ctx.emp, d.debtId)).status, 200);
  assert.equal((await pay(ctx.emp, d.debtId)).status, 400);
  assert.equal((await qa.balances()).caja, b0.caja + 1000);
});

test("TC-DEB-07 cobros simultáneos de la misma deuda: solo uno cobra", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Paralelo"));
  const b0 = await qa.balances();
  const rs = await Promise.all([pay(ctx.emp, d.debtId), pay(ctx.admin, d.debtId)]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await qa.balances()).caja, b0.caja + 1000, "Caja no debe sumar dos veces");
});

test("TC-DEB-08 agrupar por persona sin importar mayúsculas ni espacios", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20, price: 1000 });
  const ana = name("Ana Prueba");
  await fiado(ctx.emp, [[p, 1]], ana, "8888-1111");
  await fiado(ctx.emp, [[p, 2]], `  ${ana.toLowerCase()}  `);
  await fiado(ctx.emp, [[p, 1]], name("Otro"));
  const r = await ctx.emp.get("/api/debts/customers");
  assert.equal(r.status, 200);
  const mine = r.data.customers.filter((c) => c.customer_name.trim().toLowerCase() === ana.toLowerCase());
  assert.equal(mine.length, 1, "Ana debe aparecer en un solo grupo");
  assert.equal(mine[0].count, 2);
  assert.equal(parseFloat(mine[0].total), 3000);
  assert.equal(mine[0].customer_phone, "8888-1111");
  const otro = r.data.customers.filter((c) => c.customer_name === name("Otro"));
  assert.equal(otro.length, 1);
  assert.equal(otro[0].count, 1);
});

test("TC-DEB-09 / 10 / 11 cobrar todo a una persona: un movimiento, no toca a otros, sin pendientes da 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20, price: 1000 });
  const ana = name("Cobro Grupal");
  const d1 = await fiado(ctx.emp, [[p, 1]], ana);
  const d2 = await fiado(ctx.emp, [[p, 2]], ana.toUpperCase());
  const otro = await fiado(ctx.emp, [[p, 1]], name("Ajeno"));
  const b0 = await qa.balances();

  const r = await ctx.emp.post("/api/debts/pay-customer", { customer_name: ana, payment_method: "efectivo", cash_received: 10000 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.count, 2);
  assert.equal(r.data.amount, 3000);

  assert.equal((await debtRow(d1.debtId)).status, "pagada");
  assert.equal((await debtRow(d2.debtId)).status, "pagada");
  assert.equal((await saleRow(d1.saleId)).status, "completada");
  assert.equal((await saleRow(d2.saleId)).status, "completada");
  assert.equal((await qa.balances()).caja, b0.caja + 3000);
  const mv = await qa.pool.query(
    "SELECT description, amount FROM treasury_movements WHERE category = 'cobro_deuda' AND reference_sale_id = ANY($1::uuid[])",
    [[d1.saleId, d2.saleId]],
  );
  assert.equal(mv.rows.length, 1, "debe haber un solo movimiento por el total");
  assert.equal(parseFloat(mv.rows[0].amount), 3000);
  assert.match(mv.rows[0].description, /2 pendientes/);

  // TC-DEB-11: el otro cliente sigue pendiente
  assert.equal((await debtRow(otro.debtId)).status, "pendiente");
  // TC-DEB-10: ya no tiene pendientes
  const again = await ctx.emp.post("/api/debts/pay-customer", { customer_name: ana, payment_method: "efectivo" });
  assert.equal(again.status, 400);
  assert.equal((await qa.balances()).caja, b0.caja + 3000);
});

test("TC-DEB-12 el historial incluye las deudas cobradas", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Historial"));
  await pay(ctx.emp, d.debtId);
  const r = await ctx.emp.get("/api/debts?status=pagada&limit=500");
  assert.equal(r.status, 200);
  assert.ok(r.data.debts.some((x) => x.id === d.debtId));
  const pend = await ctx.emp.get("/api/debts?status=pendiente&limit=500");
  assert.equal(pend.data.debts.some((x) => x.id === d.debtId), false);
});

// ───────────── EDICIÓN DE PENDIENTES ─────────────
const putItems = (client, id, items) => client.put(`/api/debts/${id}/items`, { items });

test("TC-EDT-01 agregar un producto nuevo a un pendiente", async () => {
  const a = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const q = await qa.mkProduct(ctx, { stock: 10, price: 500 });
  const d = await fiado(ctx.emp, [[a, 1]], name("Agrega"));
  const r = await putItems(ctx.emp, d.debtId, [{ product_id: q.id, quantity: 2 }]);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await qa.stockOf(q.id), 8);
  assert.equal(await qa.stockOf(a.id), 9);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 2000);
  const s = await saleRow(d.saleId);
  assert.equal(parseFloat(s.total), 2000);
  assert.equal(parseFloat(s.subtotal), 2000);
  const mv = (await qa.movements(q.id)).pop();
  assert.deepEqual([mv.type, mv.quantity], ["venta", 2]);
  assert.match(mv.reason, /agregado a pendiente/);
});

test("TC-EDT-02 / 03 aumentar y luego reducir la cantidad (admin)", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Cantidad"));
  assert.equal(await qa.stockOf(p.id), 19);

  assert.equal((await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 3 }])).status, 200);
  assert.equal(await qa.stockOf(p.id), 17);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 3000);

  assert.equal((await putItems(ctx.admin, d.debtId, [{ product_id: p.id, quantity: 1 }])).status, 200);
  assert.equal(await qa.stockOf(p.id), 19);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 1000);
  const mv = (await qa.movements(p.id)).pop();
  assert.deepEqual([mv.type, mv.quantity], ["entrada", 2]);
});

test("TC-EDT-04 quitar un producto (cantidad 0) conservando el otro", async () => {
  const a = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const b = await qa.mkProduct(ctx, { stock: 10, price: 500 });
  const d = await fiado(ctx.emp, [[a, 1], [b, 2]], name("Quita"));
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 2000);
  const r = await putItems(ctx.admin, d.debtId, [{ product_id: b.id, quantity: 0 }]);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await qa.stockOf(b.id), 10, "el stock del producto quitado se devuelve");
  assert.equal(await qa.stockOf(a.id), 9);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 1000);
  const left = await qa.pool.query("SELECT product_id FROM sale_items WHERE sale_id = $1", [d.saleId]);
  assert.deepEqual(left.rows.map((x) => x.product_id), [a.id]);
});

test("TC-EDT-05 / 06 el empleado no puede reducir pero sí agregar", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 2]], name("Permisos"));
  const deny = await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 1 }]);
  assert.equal(deny.status, 403);
  assert.equal(await qa.stockOf(p.id), 18);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 2000);

  const allow = await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 3 }]);
  assert.equal(allow.status, 200);
  assert.equal(await qa.stockOf(p.id), 17);
});

test("TC-EDT-07 exceder el stock disponible: 400 sin cambios", async () => {
  const p = await qa.mkProduct(ctx, { stock: 5, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Exceso"));
  const r = await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 999 }]);
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(p.id), 4);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 1000);
});

test("TC-EDT-08 vaciar el fiado: 400 y rollback total", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 2]], name("Vacio"));
  const r = await putItems(ctx.admin, d.debtId, [{ product_id: p.id, quantity: 0 }]);
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(p.id), 8, "el stock no debe haberse devuelto");
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 2000);
  const items = await qa.pool.query("SELECT quantity FROM sale_items WHERE sale_id = $1", [d.saleId]);
  assert.equal(items.rows.length, 1);
});

test("TC-EDT-09 editar un pendiente ya cobrado: 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Pagado"));
  assert.equal((await pay(ctx.emp, d.debtId)).status, 200);
  const r = await putItems(ctx.admin, d.debtId, [{ product_id: p.id, quantity: 5 }]);
  assert.equal(r.status, 400);
  assert.equal(await qa.stockOf(p.id), 9);
});

test("TC-EDT-10 payloads inválidos: 400", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Invalido"));
  assert.equal((await putItems(ctx.admin, d.debtId, [{ product_id: "no-es-uuid", quantity: 1 }])).status, 400);
  assert.equal((await putItems(ctx.admin, d.debtId, [{ product_id: p.id, quantity: -1 }])).status, 400);
  assert.equal((await putItems(ctx.admin, d.debtId, [{ product_id: p.id, quantity: 10000 }])).status, 400);
  assert.equal((await putItems(ctx.admin, d.debtId, [])).status, 400);
  assert.equal(await qa.stockOf(p.id), 9);
});

test("TC-EDT-11 conserva el precio original aunque el producto cambie de precio", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("Precio"));
  const up = await ctx.admin.put(`/api/products/${p.id}`, { sale_price: 1500 });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  const r = await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 2 }]);
  assert.equal(r.status, 200);
  assert.equal(parseFloat((await debtRow(d.debtId)).amount), 2000, "debe seguir cobrando 1000 c/u");
});

test("TC-EDT-12 renombrar, unir grupos y cliente inexistente", async () => {
  const p = await qa.mkProduct(ctx, { stock: 20, price: 1000 });
  const base = name("Renombrar");
  const d1 = await fiado(ctx.emp, [[p, 1]], base);
  const d2 = await fiado(ctx.emp, [[p, 1]], `${base} `);
  const otro = await fiado(ctx.emp, [[p, 1]], name("Para Unir"));

  const nuevo = name("Nombre Nuevo");
  const r = await ctx.emp.patch("/api/debts/customer", { customer_name: base, new_name: nuevo, new_phone: "8000-0000" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.updated, 2);
  for (const d of [d1, d2]) {
    const row = await debtRow(d.debtId);
    assert.equal(row.customer_name, nuevo);
    assert.equal(row.customer_phone, "8000-0000");
  }

  // unir: renombrar "Para Unir" con el nombre que ya existe
  const merge = await ctx.emp.patch("/api/debts/customer", { customer_name: name("Para Unir"), new_name: nuevo.toLowerCase() });
  assert.equal(merge.status, 200);
  const list = await ctx.emp.get("/api/debts/customers");
  const group = list.data.customers.filter((c) => c.customer_name.trim().toLowerCase() === nuevo.toLowerCase());
  assert.equal(group.length, 1);
  assert.equal(group[0].count, 3);
  assert.equal((await debtRow(otro.debtId)).customer_name, nuevo.toLowerCase());

  const none = await ctx.emp.patch("/api/debts/customer", { customer_name: `nadie-${ctx.tag}`, new_name: "X" });
  assert.equal(none.status, 404);
});

test("TC-EDT-13 cobrar después de editar usa el monto nuevo", async () => {
  const p = await qa.mkProduct(ctx, { stock: 10, price: 1000 });
  const d = await fiado(ctx.emp, [[p, 1]], name("EditaCobra"));
  assert.equal((await putItems(ctx.emp, d.debtId, [{ product_id: p.id, quantity: 4 }])).status, 200);
  const b0 = await qa.balances();
  const r = await pay(ctx.emp, d.debtId, { payment_method: "efectivo", cash_received: 4000 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await qa.balances()).caja, b0.caja + 4000);
  assert.equal((await saleRow(d.saleId)).status, "completada");
});
