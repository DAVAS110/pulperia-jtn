// Pruebas de interfaz. Levanta (o reutiliza) el backend en :3001 y Vite en :5173.
// Solo corre contra una base de datos LOCAL: global-setup lo verifica.
const { defineConfig, devices } = require("@playwright/test");

const MOBILE = /mobile\.spec\.js$/;

module.exports = defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./support/global-setup.js"),
  globalTeardown: require.resolve("./support/global-teardown.js"),
  workers: 1, // los casos comparten la base y los saldos de tesorería
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome", // usa el Chrome instalado; no descarga navegadores
    headless: true,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: MOBILE },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], channel: "chrome", viewport: { width: 390, height: 844 } },
      testMatch: MOBILE,
    },
  ],
  webServer: [
    {
      command: "node src/index.js",
      cwd: "../backend",
      url: "http://localhost:3001/health",
      reuseExistingServer: true,
      timeout: 30_000,
      env: { NODE_ENV: "development", PORT: "3001", FRONTEND_URL: "http://localhost:5173" },
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      cwd: "../frontend",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
