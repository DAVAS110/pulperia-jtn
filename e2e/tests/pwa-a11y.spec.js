// TC-UI-18 (encabezados) y TC-UI-19 (PWA)
const { test, expect, loginAs } = require("../support/test");

const RUTAS = [
  "/", "/productos", "/categorias", "/movimientos", "/alertas", "/caja", "/ventas",
  "/qr", "/configuracion", "/combos", "/pendientes", "/horarios", "/tesoreria",
];

test("TC-UI-18 cada página tiene un solo h1 y no salta niveles de encabezado", async ({ page, fx, ip }) => {
  await loginAs(page, "admin", fx, ip);
  const problemas = [];
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    const niveles = await page.evaluate(() =>
      [...document.querySelectorAll(".page-container h1, .page-container h2, .page-container h3, .page-container h4")].map((h) =>
        Number(h.tagName[1]),
      ),
    );
    const h1s = await page.locator("h1").count();
    if (h1s !== 1) problemas.push(`${ruta}: ${h1s} h1`);
    let prev = 0;
    for (const n of niveles) {
      if (n > prev + 1) problemas.push(`${ruta}: salta de h${prev} a h${n}`);
      prev = Math.max(prev, n);
    }
  }
  expect(problemas, problemas.join(" | ")).toEqual([]);
});

test("TC-UI-19 el manifest PWA y sus íconos se sirven", async ({ page }) => {
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name || manifest.short_name).toBeTruthy();
  expect(manifest.icons.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    const r = await page.request.get(icon.src.startsWith("/") ? icon.src : `/${icon.src}`);
    expect(r.ok(), `ícono ${icon.src}`).toBe(true);
  }
});
