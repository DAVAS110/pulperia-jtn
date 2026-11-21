// TC-UI-16 y 17 — corre en el proyecto "mobile" (390×844)
const { test, expect, loginAs } = require("../support/test");

const RUTAS = [
  "/", "/productos", "/categorias", "/movimientos", "/alertas", "/caja", "/ventas",
  "/qr", "/configuracion", "/combos", "/pendientes", "/horarios", "/tesoreria",
];

for (const ruta of RUTAS) {
  test(`TC-UI-16 móvil sin scroll horizontal: ${ruta}`, async ({ page, fx, ip }) => {
    await loginAs(page, "admin", fx, ip);
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800); // deja terminar las cargas de datos
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(m.sw, `scrollWidth ${m.sw} > ancho ${m.iw}`).toBeLessThanOrEqual(m.iw);
  });
}

test("TC-UI-17 el menú hamburguesa abre el sidebar, navega y se cierra", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  await page.goto("/");
  const sidebar = page.locator("aside.sidebar");
  await expect(sidebar).not.toBeInViewport();
  await page.locator(".menu-toggle").click();
  await expect(sidebar).toBeInViewport();
  await sidebar.getByRole("link", { name: "Productos" }).click();
  await expect(page).toHaveURL(/\/productos$/);
  await expect(sidebar).not.toBeInViewport();
});
