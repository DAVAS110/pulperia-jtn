// Crea datos QA (usuarios y productos con prefijo propio) y guarda el "fixture" en un JSON.
const fs = require("fs");
const path = require("path");
const qa = require("../../backend/tests/qa/helpers");

module.exports = async () => {
  const ctx = await qa.createBaseFixture(); // verifica que la base sea local
  const mk = async (label, price, stock) => {
    ctx.skuCount += 1;
    const sku = `QA${ctx.tag}-${ctx.skuCount}`;
    const name = `QA ${label} ${ctx.tag}`;
    const { rows } = await qa.pool.query(
      `INSERT INTO products (name, sku, sale_price, cost_price, stock, min_stock)
       VALUES ($1,$2,$3,$4,$5,1) RETURNING id`,
      [name, sku, price, Math.round(price / 2), stock],
    );
    return { id: rows[0].id, sku, name, price };
  };
  const products = {
    gaseosa: await mk("Gaseosa", 1000, 200),
    galleta: await mk("Galleta", 500, 200),
    cafe: await mk("Cafe", 1500, 200),
  };
  const fixture = {
    tag: ctx.tag,
    password: ctx.password,
    snapshot: ctx.snapshot,
    adminUser: ctx.adminUser,
    empUser: ctx.empUser,
    skuCount: ctx.skuCount,
    comboPrefix: ctx.comboPrefix,
    products,
  };
  fs.writeFileSync(path.join(__dirname, "..", ".fixture.json"), JSON.stringify(fixture, null, 2));
  // el pool se cierra en global-teardown (mismo proceso)
};
