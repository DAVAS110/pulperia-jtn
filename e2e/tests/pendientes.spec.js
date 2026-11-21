// TC-UI-11 … 15 — ver backend/tests/QA_TEST_CASES.md
const { test, expect, loginAs, apiClient, createFiado, qa } = require("../support/test");
const loadFixture = require("../support/fixture");

const money = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/g, "$1\\D*"));

// Los casos comparten datos y van en orden
test.describe.configure({ mode: "serial" });

let ana;
let beto;
let anaNuevo;
test.beforeAll(async () => {
  const fx = loadFixture();
  ana = `QA Ana ${fx.tag}`;
  beto = `QA Beto ${fx.tag}`;
  anaNuevo = `QA Ana Maria ${fx.tag}`;
  const admin = await apiClient(fx, "admin");
  await createFiado(admin, [[fx.products.gaseosa, 1]], ana, "8111-2222"); // 1 000
  await createFiado(admin, [[fx.products.galleta, 2]], ana.toLowerCase()); // 1 000
  await createFiado(admin, [[fx.products.cafe, 1]], beto); // 1 500
});

const grupo = (page, nombre) => page.locator(".debt-group", { hasText: nombre });

test("TC-UI-11 pendientes agrupados por persona, con total y detalle", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  await page.goto("/pendientes");
  const g = grupo(page, ana);
  await expect(g).toHaveCount(1); // "QA Ana" y "qa ana" son la misma persona
  await expect(g).toContainText("2 pendiente(s)");
  await expect(g.locator(".debt-group-total")).toHaveText(money(2000));
  await expect(grupo(page, beto)).toContainText("1 pendiente(s)");
  await expect(g.locator(".debt-group-row")).toHaveCount(0);
  await g.locator(".debt-group-toggle").click();
  await expect(g.locator(".debt-group-row")).toHaveCount(2);
});

test("TC-UI-15 corregir el nombre del cliente", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  await page.goto("/pendientes");
  await grupo(page, ana).getByRole("button", { name: "Corregir nombre o teléfono" }).click();
  const modal = page.locator(".modal");
  await expect(modal).toContainText("Corregir cliente");
  await modal.locator("input").first().fill(anaNuevo);
  await modal.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".toast-success")).toBeVisible();
  await expect(grupo(page, anaNuevo)).toHaveCount(1);
  await expect(page.locator(".debt-group-info .d-name", { hasText: new RegExp(`^${ana}$`, "i") })).toHaveCount(0);
});

test("TC-UI-13 el editor agrega un producto y actualiza el monto y el stock", async ({ page, fx, ip }) => {
  const galleta = fx.products.galleta;
  const stock0 = await qa.stockOf(galleta.id);
  await loginAs(page, "admin", fx, ip);
  await page.goto("/pendientes");
  const g = grupo(page, beto);
  await g.locator(".debt-group-toggle").click();
  await g.getByRole("button", { name: "Editar productos" }).click();
  const modal = page.locator(".modal");
  await expect(modal).toContainText(`Editar pendiente de ${beto}`);
  await modal.getByPlaceholder("Buscar por nombre o SKU…").fill(galleta.name);
  await modal.locator(".debt-edit-result", { hasText: galleta.name }).click();
  await expect(modal.locator(".debt-edit-total")).toHaveText(money(2000));
  await modal.getByRole("button", { name: /Guardar cambios/ }).click();
  await expect(page.locator(".toast-success")).toContainText(/actualizado/i);
  await expect(grupo(page, beto).locator(".debt-group-total")).toHaveText(money(2000));
  await expect.poll(() => qa.stockOf(galleta.id)).toBe(stock0 - 1);
});

test("TC-UI-14 el empleado no puede quitar ni reducir productos en el editor", async ({ page, fx, ip }) => {
  await loginAs(page, "employee", fx, ip);
  await page.goto("/pendientes");
  const g = grupo(page, beto);
  await g.locator(".debt-group-toggle").click();
  await g.getByRole("button", { name: "Editar productos" }).click();
  const modal = page.locator(".modal");
  await expect(modal).toContainText("Solo un administrador puede quitar o reducir");
  await expect(modal.getByRole("button", { name: "Quitar del pendiente" })).toHaveCount(0);
  const restar = modal.getByRole("button", { name: "Restar uno" });
  const n = await restar.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(restar.nth(i)).toBeDisabled();
  // sí puede agregar
  await modal.getByRole("button", { name: "Sumar uno" }).first().click();
  await expect(modal.getByRole("button", { name: /Guardar cambios/ })).toBeEnabled();
});

test("TC-UI-12 «Cobrar todo» cobra a la persona y suma el total a Caja", async ({ page, fx, ip }) => {
  const b0 = await qa.balances();
  await loginAs(page, "admin", fx, ip);
  await page.goto("/pendientes");
  await grupo(page, anaNuevo).getByRole("button", { name: /Cobrar todo/ }).click();
  const modal = page.locator(".modal");
  await expect(modal).toContainText(`Cobrar todo a ${anaNuevo}`);
  await modal.getByRole("button", { name: /Confirmar Cobro/ }).click();
  await expect(page.locator(".toast-success")).toContainText(/cobrados/);
  await expect(grupo(page, anaNuevo)).toHaveCount(0);
  await expect(grupo(page, beto)).toHaveCount(1); // el otro cliente sigue pendiente
  await expect.poll(async () => (await qa.balances()).caja).toBe(b0.caja + 2000);
});
