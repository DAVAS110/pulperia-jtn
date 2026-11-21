// TC-UI-07 … 10 — ver backend/tests/QA_TEST_CASES.md
const { test, expect, loginAs, apiClient, createFiado, qa } = require("../support/test");

// Tolera el separador de miles que use el formato de moneda (espacio, punto, coma…)
const money = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/g, "$1\\D*"));

async function addProduct(page, product) {
  await page.getByPlaceholder("Buscar producto…").fill(product.name);
  await page.getByText(product.name, { exact: false }).first().click();
  await page.getByPlaceholder("Buscar producto…").fill("");
}

test("TC-UI-07 vender en efectivo desde Caja registra la venta y baja el stock", async ({ page, fx, ip }) => {
  const p = fx.products.gaseosa;
  const stock0 = await qa.stockOf(p.id);
  const b0 = await qa.balances();
  await loginAs(page, "employee", fx, ip);
  await page.goto("/caja");
  await addProduct(page, p);
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await page.getByRole("button", { name: /^Cobrar$/ }).click();
  const modal = page.locator(".modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Confirmar Venta/ }).click();
  await expect(page.locator(".toast-success")).toBeVisible();
  await expect.poll(() => qa.stockOf(p.id)).toBe(stock0 - 1);
  expect((await qa.balances()).caja).toBe(b0.caja + p.price);
});

test("TC-UI-08 el total del carrito refleja cantidad × precio", async ({ page, fx, ip }) => {
  const p = fx.products.cafe; // ₡1 500
  await loginAs(page, "employee", fx, ip);
  await page.goto("/caja");
  await expect(page.getByRole("button", { name: /^Cobrar$/ })).toBeDisabled();
  await addProduct(page, p);
  await page.locator(".qty-btn").last().click();
  await page.locator(".qty-btn").last().click();
  await expect(page.locator(".qty-display")).toHaveText("3");
  await expect(page.locator(".cart-total-value")).toHaveText(money(4500));
  await expect(page.getByRole("button", { name: /^Cobrar$/ })).toBeEnabled();
});

test.describe("fiado desde Caja", () => {
  test.describe.configure({ mode: "serial" });

  test("TC-UI-09 sugiere al cliente con pendientes y avisa que se sumará a su cuenta", async ({ page, fx, ip }) => {
    const cliente = `QA Cliente UI ${fx.tag}`;
    const emp = await apiClient(fx, "employee");
    await createFiado(emp, [[fx.products.galleta, 1]], cliente, "8000-1234");

    await loginAs(page, "employee", fx, ip);
    await page.goto("/caja");
    await addProduct(page, fx.products.galleta);
    await page.getByRole("button", { name: /Dejar pendiente/ }).click();
    const modal = page.locator(".modal");
    await modal.getByPlaceholder("Ej: Juan Pérez").fill(cliente);
    await expect(modal.getByText(/Ya tiene 1 pendiente\(s\)/)).toBeVisible();
    await expect(modal.getByText(/se sumará a su cuenta/)).toBeVisible();
    await expect(modal.getByPlaceholder("Ej: 8888-8888")).toHaveValue("8000-1234");
    const opciones = await page.locator("#debt-customers option").evaluateAll((os) => os.map((o) => o.value));
    expect(opciones).toContain(cliente);
  });

  test("TC-UI-10 dejar un fiado crea el pendiente, baja el stock y no mueve Caja", async ({ page, fx, ip }) => {
    const cliente = `QA Cliente UI ${fx.tag}`;
    const p = fx.products.galleta;
    const stock0 = await qa.stockOf(p.id);
    const b0 = await qa.balances();

    await loginAs(page, "employee", fx, ip);
    await page.goto("/caja");
    await addProduct(page, p);
    await page.getByRole("button", { name: /Dejar pendiente/ }).click();
    const modal = page.locator(".modal");
    await modal.getByPlaceholder("Ej: Juan Pérez").fill(cliente);
    await modal.getByRole("button", { name: /Dejar Pendiente/ }).click();
    await expect(page.locator(".toast-success")).toContainText(/Pendiente guardado/);

    await expect.poll(() => qa.stockOf(p.id)).toBe(stock0 - 1);
    const { rows } = await qa.pool.query(
      "SELECT count(*)::int AS n, sum(amount)::float AS total FROM debts WHERE customer_name = $1 AND status = 'pendiente'",
      [cliente],
    );
    expect(rows[0].n).toBe(2); // el de la prueba anterior + este
    expect(rows[0].total).toBe(1000);
    expect(await qa.balances()).toEqual(b0);
  });
});
