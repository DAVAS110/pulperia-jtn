# Casos de prueba QA — Pulpería JTN

Alcance: API del backend (la lógica de negocio: stock, tesorería, ventas, pendientes, permisos y seguridad).
Cada caso tiene un ID (`TC-…`) que aparece en el nombre del test automatizado correspondiente.

## Cómo se ejecutan

```bash
cd backend
npm run test:qa
```

Reglas de seguridad de la suite:

- **Solo corre contra una base local** (`localhost`, `127.0.0.1`, `::1`, `db`, `postgres` o `host.docker.internal`). Si `DATABASE_URL` apunta a otro host, se niega a ejecutarse (protege Supabase/producción).
- Crea sus propios datos (usuarios, productos y combos con el prefijo `QA`) y los **borra al terminar**.
- Guarda los saldos de Caja y SINPE antes de empezar y los **restaura** al final.
- Levanta su propio backend en un puerto aparte (3100+), así que no choca con tu `npm run dev`.

Leyenda de prioridad: **P1** = rompe dinero, stock o seguridad. **P2** = funcionalidad importante. **P3** = robustez.

---

## 1. Autenticación y permisos (AUTH)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-AUTH-01 | P1 | Login válido | POST /auth/login con credenciales correctas | 200, cookie `auth_token` HttpOnly, la respuesta no incluye `password_hash` |
| TC-AUTH-02 | P1 | Contraseña incorrecta | Login con password errónea | 401 |
| TC-AUTH-03 | P1 | Ruta protegida sin sesión | GET /products sin cookie | 401 |
| TC-AUTH-04 | P1 | Empleado en ruta de admin | Empleado GET /treasury, GET /auth/users | 403 |
| TC-AUTH-05 | P1 | Usuario desactivado pierde acceso al instante | Admin desactiva al empleado; el empleado llama GET /auth/me | 401 (el caché de 30 s se invalida) |
| TC-AUTH-06 | P2 | Validación de login | Login con email inválido | 400 |
| TC-AUTH-07 | P2 | Alta de usuario | Admin crea empleado; mismo email; password de 3 caracteres | 201; 409; 400 |
| TC-AUTH-08 | P1 | Listado de usuarios no expone hashes | Admin GET /auth/users | Ningún usuario trae `password_hash` |

## 2. Productos (PRO)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-PRO-01 | P1 | Crear producto con stock inicial | Admin POST /products con stock 10 | 201; stock 10; movimiento `entrada` "Stock inicial" |
| TC-PRO-02 | P2 | SKU duplicado | Crear dos productos con el mismo SKU | Segundo: 409 |
| TC-PRO-03 | P2 | Validación de precio | sale_price negativo | 400 |
| TC-PRO-04 | P1 | El empleado no ve el costo | Empleado GET /products y /products/:id | Sin `cost_price` |
| TC-PRO-05 | P3 | Paginación acotada | GET /products?limit=99999&page=-3 | 200, `limit` ≤ 500 |
| TC-PRO-06 | P2 | Búsqueda | GET /products?search=<parte del SKU> | Aparece el producto |
| TC-PRO-07 | P3 | Búsqueda con inyección SQL | search=`' OR 1=1 --` | 200 sin error y sin devolver todo el catálogo |
| TC-PRO-08 | P2 | Producto eliminado no se puede vender | Admin DELETE /products/:id; intentar vender | La venta falla (400) y no cambia el stock |

## 3. Inventario (INV)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-INV-01 | P1 | Entrada de stock | POST /inventory type=entrada qty=5 | Stock +5; movimiento registrado |
| TC-INV-02 | P1 | Salida de stock | type=salida qty=3 | Stock −3; movimiento registrado |
| TC-INV-03 | P1 | Salida mayor al stock | Salida con qty > stock | 400, stock intacto **y la fila del producto no queda bloqueada** (la siguiente entrada responde rápido) |
| TC-INV-04 | P2 | Ajuste absoluto | type=ajuste qty=7 | Stock queda exactamente en 7 |
| TC-INV-05 | P2 | Cantidad inválida | qty=0 y qty=−2 | 400 |

## 4. Ventas (SAL)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-SAL-01 | P1 | Venta en efectivo | Vender 3 u. pagando en efectivo con vuelto | Stock −3; movimiento `venta`; Caja +total; venta `completada`; vuelto correcto |
| TC-SAL-02 | P1 | Venta por SINPE | SINPE con `received_by`; y sin `received_by` | SINPE +total; sin `received_by`: 400 sin efectos |
| TC-SAL-03 | P1 | Stock insuficiente es atómico | Venta de 2 productos donde el 2.º no alcanza | 400; **ningún** stock cambia; Caja intacta; no queda venta |
| TC-SAL-04 | P1 | Efectivo menor al total | cash_received < total | 400 sin efectos |
| TC-SAL-05 | P2 | Venta vacía o sin método | items=[] / sin payment_method | 400 |
| TC-SAL-06 | P1 | Venta de combo | Vender 2 combos | Descuenta cada componente × 2; Caja + precio del combo × 2 |
| TC-SAL-07 | P1 | Combo con componente sin stock | Combo cuyo componente no alcanza | 400; nada cambia |
| TC-SAL-08 | P1 | Anular venta | Admin DELETE /sales/:id | Stock restituido; movimiento `entrada`; Caja −total; estado `anulada`; segunda anulación: 404 |
| TC-SAL-09 | P1 | Empleado no puede anular | Empleado DELETE /sales/:id | 403 |
| TC-SAL-10 | P1 | Concurrencia sobre la última unidad | 2 ventas simultáneas del mismo producto con stock 1 | Exactamente 1 éxito y 1 error; stock 0, nunca negativo |
| TC-SAL-11 | P1 | Anular una venta fiada ya cobrada en efectivo | Fiado → cobrar en efectivo → anular la venta | Se revierte **Caja** (no SINPE) y vuelve el stock |
| TC-SAL-12 | P3 | Listado de ventas | GET /sales?limit=99999 | 200, `limit` acotado |

## 5. Pendientes / fiado (DEB)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-DEB-01 | P1 | Crear fiado | Venta con payment_method=fiado | Deuda `pendiente`; stock baja; tesorería **sin cambios**; venta `pendiente` |
| TC-DEB-02 | P2 | Fiado sin nombre | Sin customer_name | 400 sin efectos |
| TC-DEB-03 | P1 | Cobro individual en efectivo | POST /debts/:id/pay | Deuda `pagada`; venta `completada`; Caja +monto; movimiento `cobro_deuda` |
| TC-DEB-04 | P1 | Efectivo recibido menor | cash_received < monto | 400; sigue pendiente; tesorería intacta |
| TC-DEB-05 | P1 | SINPE sin quién recibió | payment_method=sinpe sin received_by | 400; sigue pendiente |
| TC-DEB-06 | P1 | Doble cobro secuencial | Cobrar dos veces la misma deuda | Segundo: 400; Caja suma una sola vez |
| TC-DEB-07 | P1 | Cobros simultáneos | 2 cobros en paralelo de la misma deuda | Solo uno cobra; Caja suma una sola vez |
| TC-DEB-08 | P1 | Agrupar por persona | Fiados a "Ana Prueba", "ana prueba " y otro cliente | `/debts/customers` junta a Ana (count y total correctos) y deja al otro aparte |
| TC-DEB-09 | P1 | Cobrar todo a una persona | POST /debts/pay-customer | Todas `pagadas`; un solo movimiento por el total; Caja + total |
| TC-DEB-10 | P2 | Cobrar todo sin pendientes | pay-customer de un cliente sin deudas | 400 |
| TC-DEB-11 | P1 | Cobro grupal no toca a otros | pay-customer de Ana | Las deudas del otro cliente siguen pendientes |
| TC-DEB-12 | P3 | Historial | GET /debts?status=pagada | Incluye las deudas cobradas |

## 6. Edición de pendientes (EDT)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-EDT-01 | P1 | Agregar un producto nuevo | PUT /debts/:id/items con un producto que no estaba | Stock −cantidad; monto sube; movimiento `venta`; total de la venta sincronizado |
| TC-EDT-02 | P1 | Aumentar cantidad | De 1 a 3 | Stock −2; monto = 3 × precio |
| TC-EDT-03 | P1 | Reducir cantidad (admin) | De 3 a 1 | Stock +2; monto baja; movimiento `entrada` |
| TC-EDT-04 | P1 | Quitar un producto (cantidad 0) | Con otro producto presente | Línea eliminada; stock devuelto; monto recalculado |
| TC-EDT-05 | P1 | Empleado no puede reducir | Empleado baja cantidad | 403; sin cambios |
| TC-EDT-06 | P2 | Empleado sí puede agregar | Empleado sube cantidad | 200 |
| TC-EDT-07 | P1 | Exceder stock | Agregar más de lo disponible | 400; sin cambios |
| TC-EDT-08 | P1 | Vaciar el fiado | Dejar todas las líneas en 0 | 400; rollback total (stock y monto intactos) |
| TC-EDT-09 | P1 | Editar un pendiente ya cobrado | PUT sobre deuda pagada | 400; sin cambios |
| TC-EDT-10 | P2 | Payload inválido | product_id no UUID; cantidad negativa; items vacío | 400 |
| TC-EDT-11 | P1 | Respeta el precio original | Cambiar el precio del producto y subir la cantidad | La línea conserva el precio original; el monto no usa el precio nuevo |
| TC-EDT-12 | P2 | Renombrar / unir clientes | PATCH /debts/customer | Todos sus pendientes se renombran; si el nombre existe, se unen; cliente inexistente: 404 |
| TC-EDT-13 | P1 | Cobrar tras editar | Editar y luego cobrar | Tesorería recibe el monto **nuevo** |

## 7. Tesorería (TRE)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-TRE-01 | P1 | Depósito y retiro | Depositar 1000 y retirar 400 en Caja | Saldo +1000 y −400; un movimiento por cada operación |
| TC-TRE-02 | P1 | Retiro mayor al saldo | Retirar más de lo que hay | 400; saldo intacto |
| TC-TRE-03 | P2 | Montos inválidos | amount 0 y −5 | 400 |
| TC-TRE-04 | P1 | Empleado sin acceso | Empleado depositando | 403 |

## 8. Seguridad (SEC)

| ID | Prioridad | Caso | Pasos | Resultado esperado |
|---|---|---|---|---|
| TC-SEC-01 | P1 | CORS | Petición con `Origin` ajeno | No hay `Access-Control-Allow-Origin` para ese origen |
| TC-SEC-02 | P2 | Cabeceras de seguridad | GET /health | `x-content-type-options`, `strict-transport-security`, sin `x-powered-by` |
| TC-SEC-03 | P1 | Rate limit de login | 6 logins fallidos desde la misma IP | El 6.º devuelve 429 |
| TC-SEC-04 | P2 | Payload demasiado grande | Body de más de 2 MB | 413 |
| TC-SEC-05 | P2 | Errores sin filtrar detalles | Ruta inexistente y body JSON roto | Respuesta limpia, sin stack trace |

## 9. Interfaz (UI) — automatizada con Playwright

Se ejecuta con `cd e2e && npm test` (ver `e2e/README.md`). Usa Chrome real, la base local y datos QA propios (se limpian al terminar). Los casos móviles corren en un viewport de 390×844.

| ID | Prioridad | Caso | Resultado esperado |
|---|---|---|---|
| TC-UI-01 | P1 | Login correcto | Entra al Dashboard y se ve el menú |
| TC-UI-02 | P1 | Credenciales incorrectas | Muestra el error, sigue en `/login` y no hay sesión |
| TC-UI-03 | P1 | Recargar `/caja` | Se queda en `/caja` (no vuelve al inicio) |
| TC-UI-04 | P1 | Sin sesión, ruta protegida | Redirige a `/login` |
| TC-UI-05 | P1 | Cerrar sesión | Vuelve al login y las rutas quedan bloqueadas |
| TC-UI-06 | P1 | Empleado: menú y rutas de admin | No ve Tesorería ni Configuración; `/tesoreria` lo devuelve al inicio |
| TC-UI-07 | P1 | Caja: vender en efectivo | La venta se registra y el stock baja en la base |
| TC-UI-08 | P2 | Caja: total del carrito | El total refleja cantidad × precio; sin productos, Cobrar no está disponible |
| TC-UI-09 | P2 | Caja: fiado a un cliente con pendientes | Sugiere al cliente y avisa que el pendiente "se sumará a su cuenta" |
| TC-UI-10 | P1 | Caja: dejar un fiado | Se crea el pendiente, baja el stock y Caja no cambia |
| TC-UI-11 | P1 | Pendientes agrupados | Un grupo por persona con total y cantidad; se expande al detalle |
| TC-UI-12 | P1 | Pendientes: "Cobrar todo" | El grupo desaparece y Caja suma el total |
| TC-UI-13 | P1 | Pendientes: editor agrega un producto | El monto y el stock se actualizan |
| TC-UI-14 | P1 | Pendientes: empleado en el editor | No puede quitar ni reducir productos ya cargados |
| TC-UI-15 | P2 | Pendientes: corregir cliente | El grupo cambia de nombre |
| TC-UI-16 | P2 | Móvil: sin scroll horizontal | Las 13 páginas caben en 390 px |
| TC-UI-17 | P2 | Móvil: menú hamburguesa | Abre el sidebar, navega y se cierra |
| TC-UI-18 | P3 | Encabezados | Cada página tiene un solo `h1` y no salta niveles |
| TC-UI-19 | P3 | PWA | El manifest y los íconos se sirven |

Pendiente (no automatizado): instalación de la PWA y modo sin conexión, Safari/iOS y un celular real.

---

## 10. Resultado de la primera ejecución

Fecha: 2026-11-22 · Base: PostgreSQL local (Docker) · Comando: `npm run test:qa` · Duración: ~23 s

**63 tests automatizados: 60 pasan, 3 fallan.** Después de la corrida no quedaron datos de prueba y los saldos de Caja y SINPE volvieron a su valor inicial.

| Módulo | Casos | Pasan | Fallan |
|---|---|---|---|
| Autenticación (AUTH) | 8 | 8 | 0 |
| Productos, inventario y tesorería (PRO / INV / TRE) | 17 | 17 | 0 |
| Ventas (SAL) | 12 | 11 | 1 |
| Pendientes y edición (DEB / EDT) | 21* | 21 | 0 |
| Seguridad (SEC) | 5 | 3 | 2 |

\* Algunos tests cubren varios casos a la vez (por ejemplo TC-DEB-09/10/11 y TC-EDT-02/03).

### Fallos encontrados (defectos reales del sistema)

| Caso | Prioridad | Qué pasa | Dónde |
|---|---|---|---|
| **TC-SAL-11** | **P1** | Al anular una venta que fue fiado y se cobró en efectivo, se descuenta el dinero de **SINPE** en vez de **Caja**. Caja queda inflada y SINPE puede quedar bajo (o negativo). | `sales.controller.js`, función `cancel`: decide la cuenta con `payment_method === "efectivo" ? "caja" : "sinpe"`, pero en una venta fiada `payment_method` sigue siendo `fiado`. La cuenta correcta está en `debts.paid_payment_method`. |
| **TC-SEC-04** | P2 | Un body de más de 2 MB responde **500** en vez de **413**. | `index.js`: el manejador de errores devuelve siempre 500 y no respeta `err.status`. |
| **TC-SEC-05** | P2 | Un JSON mal formado responde **500** en vez de **400** (y llena el log con el stack). | Mismo manejador de errores. |

### Casos que pasaron y vale la pena destacar

- Atomicidad de las ventas (TC-SAL-03/04/07): si algo falla, no cambia ni el stock ni la tesorería.
- Concurrencia (TC-SAL-10, TC-DEB-07): dos ventas de la última unidad o dos cobros simultáneos de la misma deuda → solo uno se aplica, sin stock negativo ni doble ingreso a Caja.
- Edición de pendientes (TC-EDT-01…13): el stock, los movimientos de inventario, el total de la venta y el monto de la deuda quedan siempre consistentes.
- TC-INV-03: una salida mayor al stock no deja la fila del producto bloqueada.
- Permisos por rol, caché de usuario invalidado al desactivar y rate limit de login.

### Interfaz (Playwright) — misma fecha

**31 tests: 29 pasan, 2 fallan** (Chrome real; escritorio y móvil 390×844; ~1.5 min). Al terminar se borran los datos QA y se restauran los saldos.

| Fallo | Prioridad | Qué pasa | Causa |
|---|---|---|---|
| **TC-UI-05** | **P1** | **"Cerrar sesión" no cierra la sesión.** La app muestra el login, pero al volver a `/caja` (o recargar) el usuario sigue dentro: la cookie nunca se borra. En un equipo compartido, la siguiente persona entra con la sesión anterior. | `authStore.logout` llama a `authAPI.logout()`, pero esa función **no existe** en `frontend/src/services/api.js`. El `TypeError` lo oculta un `catch {}` y nunca se envía `POST /auth/logout`. |
| **TC-UI-16** `/qr` | P2 | En móvil, la página "Códigos QR" mide 628 px en vez de 390: el panel del QR queda a la derecha de la lista y se sale de la pantalla. | `QRPage.jsx` usa `gridTemplateColumns: "300px 1fr"` fijo, sin colapsar a una columna en pantallas pequeñas. |

Notas relacionadas con TC-UI-05 (seguridad): aunque se arregle el logout, un token ya emitido sigue siendo válido hasta que expire (no hay revocación del lado del servidor).

Todos los demás casos de interfaz pasan (login, recarga en `/caja`, rutas protegidas, permisos de empleado, venta en efectivo, total del carrito, fiado con sugerencia de cliente, pendientes agrupados, "Cobrar todo", editor de pendientes, corregir cliente, menú móvil, encabezados y PWA).

---

## 11. Re-ejecución tras los arreglos

**API: 63 de 63 pasan. Interfaz: 31 de 31 pasan.** Los 5 defectos de la primera corrida quedaron corregidos:

| Defecto | Arreglo |
|---|---|
| TC-UI-05 — "Cerrar sesión" no cerraba la sesión | Se agregó `authAPI.logout` en `frontend/src/services/api.js` (la función no existía y el error se ocultaba) |
| TC-UI-16 `/qr` — desborde horizontal en móvil | `QRPage` usa la clase `.qr-layout`, que pasa a una columna en pantallas de hasta 768 px |
| TC-SAL-11 — anular una venta fiada cobrada descontaba SINPE | `cancel` usa el método con el que se cobró la deuda (`debts.paid_payment_method`) |
| TC-SEC-04 — body de más de 2 MB daba 500 | El manejador de errores devuelve el 4xx original (413) |
| TC-SEC-05 — JSON roto daba 500 | Ídem (400 "JSON inválido") |

Pendiente conocido: un token ya emitido sigue siendo válido hasta que expire, aunque se cierre sesión (no hay revocación del lado del servidor).
