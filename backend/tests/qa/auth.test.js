// TC-AUTH-01 … 08 — ver tests/QA_TEST_CASES.md
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("./helpers");

let ctx;
before(async () => {
  ctx = await qa.setup(3101);
});
after(async () => {
  await qa.teardown(ctx);
});

test("TC-AUTH-01 login válido: 200, cookie HttpOnly y sin password_hash", async () => {
  const c = qa.makeClient(ctx.base);
  const r = await c.login(ctx.adminUser.email, ctx.password);
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie") || "";
  assert.match(cookie, /auth_token=/);
  assert.match(cookie, /HttpOnly/i);
  assert.equal(r.data.user.email, ctx.adminUser.email);
  assert.equal(JSON.stringify(r.data).includes("password_hash"), false);
});

test("TC-AUTH-02 contraseña incorrecta: 401", async () => {
  const c = qa.makeClient(ctx.base);
  const r = await c.login(ctx.adminUser.email, "incorrecta-999");
  assert.equal(r.status, 401);
});

test("TC-AUTH-03 ruta protegida sin sesión: 401", async () => {
  const r = await ctx.anon.get("/api/products");
  assert.equal(r.status, 401);
});

test("TC-AUTH-04 empleado en rutas de admin: 403", async () => {
  assert.equal((await ctx.emp.get("/api/treasury")).status, 403);
  assert.equal((await ctx.emp.get("/api/auth/users")).status, 403);
});

test("TC-AUTH-05 usuario desactivado pierde el acceso al instante", async () => {
  // usuario dedicado para no afectar al resto de la suite
  const email = `qa.tmp.${ctx.tag.toLowerCase()}@qa.test`;
  const create = await ctx.admin.post("/api/auth/users", {
    name: "QA Temporal",
    email,
    password: ctx.password,
    role: "employee",
  });
  assert.equal(create.status, 201);
  ctx.extraUserIds.push(create.data.user.id);

  const c = qa.makeClient(ctx.base);
  assert.equal((await c.login(email, ctx.password)).status, 200);
  assert.equal((await c.get("/api/auth/me")).status, 200); // queda en el caché de 30 s

  const off = await ctx.admin.patch(`/api/auth/users/${create.data.user.id}`, { is_active: false });
  assert.equal(off.status, 200);
  assert.equal((await c.get("/api/auth/me")).status, 401, "el caché debe invalidarse al desactivar");
});

test("TC-AUTH-06 validación de login: email inválido → 400", async () => {
  const c = qa.makeClient(ctx.base);
  const r = await c.login("no-es-un-correo", "loquesea");
  assert.equal(r.status, 400);
});

test("TC-AUTH-07 alta de usuario: 201, email duplicado 409, password corta 400", async () => {
  const email = `qa.alta.${ctx.tag.toLowerCase()}@qa.test`;
  const body = { name: "QA Alta", email, password: ctx.password, role: "employee" };
  const ok = await ctx.admin.post("/api/auth/users", body);
  assert.equal(ok.status, 201);
  ctx.extraUserIds.push(ok.data.user.id);
  assert.equal((await ctx.admin.post("/api/auth/users", body)).status, 409);
  assert.equal((await ctx.admin.post("/api/auth/users", { ...body, email: `x.${email}`, password: "123" })).status, 400);
});

test("TC-AUTH-08 el listado de usuarios no expone hashes", async () => {
  const r = await ctx.admin.get("/api/auth/users?limit=500");
  assert.equal(r.status, 200);
  assert.ok(r.data.users.length > 0);
  assert.equal(JSON.stringify(r.data).includes("password_hash"), false);
});
