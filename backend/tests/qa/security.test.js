// TC-SEC-01 … 05 — ver tests/QA_TEST_CASES.md
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("./helpers");

let ctx;
before(async () => {
  ctx = await qa.setup(3105);
});
after(async () => {
  await qa.teardown(ctx);
});

test("TC-SEC-01 CORS: un origen ajeno no recibe permiso; el del frontend sí", async () => {
  const evil = await fetch(`${ctx.base}/health`, { headers: { Origin: "https://evil.example" } });
  const acao = evil.headers.get("access-control-allow-origin");
  assert.ok(acao !== "https://evil.example" && acao !== "*", `ACAO inesperado: ${acao}`);

  const good = await fetch(`${ctx.base}/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(good.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("TC-SEC-02 cabeceras de seguridad presentes y sin x-powered-by", async () => {
  const r = await fetch(`${ctx.base}/health`);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("strict-transport-security"));
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("TC-SEC-03 rate limit de login: el 6.º intento fallido devuelve 429", async () => {
  const c = qa.makeClient(ctx.base);
  const ip = "10.77.77.77"; // misma IP en todos los intentos
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await c.login(ctx.adminUser.email, `mala-${i}`, { ip });
    statuses.push(r.status);
  }
  assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(statuses[5], 429);
  // y otra IP sigue pudiendo entrar
  const other = await c.login(ctx.adminUser.email, ctx.password, { ip: "10.88.88.88" });
  assert.equal(other.status, 200);
});

test("TC-SEC-04 body de más de 2 MB: 413", async () => {
  const c = qa.makeClient(ctx.base);
  const big = JSON.stringify({ email: "a@b.co", password: "x".repeat(3 * 1024 * 1024) });
  const r = await c.req("POST", "/api/auth/login", big, { raw: true, headers: { "Content-Type": "application/json" } });
  assert.equal(r.status, 413);
});

test("TC-SEC-05 errores limpios: 404 sin detalles y JSON roto responde 400 (no 500)", async () => {
  const c = qa.makeClient(ctx.base);
  const nf = await c.get("/api/no-existe");
  assert.equal(nf.status, 404);
  assert.equal(JSON.stringify(nf.data).includes("node_modules"), false);

  const broken = await c.req("POST", "/api/auth/login", "{esto no es json", {
    raw: true,
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(broken.status, 400, `JSON roto devolvió ${broken.status}`);
  assert.equal(JSON.stringify(broken.data).includes("node_modules"), false);
});
