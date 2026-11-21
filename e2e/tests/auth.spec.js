// TC-UI-01 … 06 — ver backend/tests/QA_TEST_CASES.md
const { test, expect, loginAs } = require("../support/test");

test("TC-UI-01 login correcto lleva al Dashboard", async ({ page, fx }) => {
  await page.goto("/login");
  await page.getByPlaceholder("usuario@pulperia.com").fill(fx.adminUser.email);
  await page.getByPlaceholder("••••••••").fill(fx.password);
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page).toHaveURL(/localhost:5173\/$/);
  await expect(page.getByRole("link", { name: "Productos" })).toBeVisible();
});

test("TC-UI-02 credenciales incorrectas muestran error y no entran", async ({ page, fx, ip }) => {
  await page.goto("/login");
  await page.getByPlaceholder("usuario@pulperia.com").fill(fx.adminUser.email);
  await page.getByPlaceholder("••••••••").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await expect(page.locator(".toast-error")).toContainText(/credenciales/i);
  await expect(page).toHaveURL(/\/login$/);
  const me = await page.request.get("/api/auth/me", { headers: { "x-forwarded-for": ip } });
  expect(me.status()).toBe(401);
});

test("TC-UI-03 recargar /caja mantiene la página", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  await page.goto("/caja");
  await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();
});

test("TC-UI-04 sin sesión, las rutas protegidas redirigen al login", async ({ page }) => {
  for (const ruta of ["/productos", "/caja", "/pendientes"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("TC-UI-05 cerrar sesión vuelve al login y bloquea las rutas", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.locator(".logout-btn").click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/caja");
  await expect(page).toHaveURL(/\/login$/);
});

test("TC-UI-06 empleado: sin Tesorería ni Configuración y /tesoreria lo devuelve al inicio", async ({ page, fx, ip }) => {
  await loginAs(page, "employee", fx, ip);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tesorería" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  await page.goto("/tesoreria");
  await expect(page).not.toHaveURL(/tesoreria/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
