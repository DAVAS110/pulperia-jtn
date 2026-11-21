const { pool } = require("../config/database");
const { getIO } = require("../socket");

// GET /api/debts
const list = async (req, res) => {
  try {
    const { status = "pendiente" } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const offset = (page - 1) * limit;
    const params = [status, limit, offset];

    const { rows } = await pool.query(
      `
      SELECT d.id, d.sale_id, d.customer_name, d.customer_phone, d.amount, d.status,
             d.paid_at, d.paid_payment_method, d.paid_sinpe_description, d.paid_sinpe_photo,
             d.paid_received_by, d.created_at,
             u.name AS created_by_name,
             json_agg(json_build_object(
               'product_id', si.product_id, 'product_name', si.product_name, 'product_sku', si.product_sku,
               'quantity', si.quantity, 'unit_price', si.unit_price, 'subtotal', si.subtotal
             )) AS items
      FROM debts d
      LEFT JOIN users u ON u.id = d.created_by
      LEFT JOIN sale_items si ON si.sale_id = d.sale_id
      WHERE d.status = $1
      GROUP BY d.id, u.name
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      params,
    );

    const countRes = await pool.query(
      "SELECT COUNT(*)::int FROM debts WHERE status = $1",
      [status],
    );

    res.json({ debts: rows, total: countRes.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener pendientes" });
  }
};

// Normaliza el nombre para agrupar ("Juan " y "juan" son la misma persona)
const NAME_KEY = "lower(trim(customer_name))";

// Cobra una o varias deudas dentro de una transacción ya abierta.
const settleDebts = async (client, debts, payment, user) => {
  const { payment_method, cash_received, sinpe_description, sinpe_photo, received_by } =
    payment;
  const amount = debts.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  if (
    payment_method === "efectivo" &&
    cash_received != null &&
    parseFloat(cash_received) < amount
  )
    throw new Error("El efectivo recibido es menor al monto de la deuda");
  if (payment_method === "sinpe" && !received_by?.trim())
    throw new Error("Debe indicar quién recibió el SINPE");

  const debtIds = debts.map((d) => d.id);
  const saleIds = debts.map((d) => d.sale_id);

  await client.query(
    `UPDATE debts SET status = 'pagada', paid_at = NOW(), paid_payment_method = $1,
       paid_sinpe_description = $2, paid_sinpe_photo = $3, paid_received_by = $4
     WHERE id = ANY($5::uuid[])`,
    [
      payment_method,
      payment_method === "sinpe" ? sinpe_description || null : null,
      payment_method === "sinpe" ? sinpe_photo || null : null,
      received_by?.trim() || null,
      debtIds,
    ],
  );
  await client.query(
    "UPDATE sales SET status = 'completada' WHERE id = ANY($1::uuid[])",
    [saleIds],
  );

  const accountType = payment_method === "efectivo" ? "caja" : "sinpe";
  await client.query(
    "UPDATE treasury_accounts SET balance = balance + $1, updated_at = NOW() WHERE type = $2",
    [amount, accountType],
  );
  const name = debts[0].customer_name;
  await client.query(
    `INSERT INTO treasury_movements (account_type, direction, amount, category, description, reference_sale_id, user_id)
     VALUES ($1, 'entrada', $2, 'cobro_deuda', $3, $4, $5)`,
    [
      accountType,
      amount,
      debts.length === 1
        ? `Cobro de deuda: ${name}`
        : `Cobro de ${debts.length} pendientes: ${name}`,
      debts[0].sale_id,
      user.id,
    ],
  );
  return { amount, debtIds };
};

// POST /api/debts/:id/pay
const pay = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const debtRes = await client.query(
      "SELECT * FROM debts WHERE id = $1 AND status = 'pendiente' FOR UPDATE",
      [req.params.id],
    );
    if (!debtRes.rows[0])
      throw new Error("Pendiente no encontrado o ya fue cobrado");

    const { debtIds } = await settleDebts(client, debtRes.rows, req.body, req.user);
    await client.query("COMMIT");

    const io = getIO();
    if (io) io.emit("inventory-updated", { type: "debt_paid", debtId: debtIds[0] });

    res.json({ message: "Deuda cobrada correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "Error al cobrar deuda" });
  } finally {
    client.release();
  }
};

// POST /api/debts/pay-customer — cobra todos los pendientes de una persona de una vez
const payCustomer = async (req, res) => {
  const client = await pool.connect();
  try {
    const customerName = req.body.customer_name?.trim();
    if (!customerName) throw new Error("Falta el nombre del cliente");

    await client.query("BEGIN");
    const debtRes = await client.query(
      `SELECT * FROM debts
       WHERE status = 'pendiente' AND ${NAME_KEY} = lower(trim($1))
       ORDER BY created_at FOR UPDATE`,
      [customerName],
    );
    if (debtRes.rows.length === 0)
      throw new Error("Ese cliente no tiene pendientes por cobrar");

    const { amount, debtIds } = await settleDebts(
      client,
      debtRes.rows,
      req.body,
      req.user,
    );
    await client.query("COMMIT");

    const io = getIO();
    if (io) io.emit("inventory-updated", { type: "debt_paid", debtId: debtIds[0] });

    res.json({
      message: "Pendientes cobrados correctamente",
      count: debtIds.length,
      amount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "Error al cobrar pendientes" });
  } finally {
    client.release();
  }
};

// GET /api/debts/customers — clientes con pendientes (para sugerir al dejar un fiado)
const customers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT MIN(customer_name) AS customer_name,
              MAX(customer_phone) AS customer_phone,
              SUM(amount)::numeric(12,2) AS total,
              COUNT(*)::int AS count
       FROM debts
       WHERE status = 'pendiente'
       GROUP BY ${NAME_KEY}
       ORDER BY MIN(customer_name)
       LIMIT 200`,
    );
    res.json({ customers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
};

// PUT /api/debts/:id/items — edita los productos de un pendiente.
// Body: { items: [{ product_id, quantity }] } con la cantidad FINAL de cada producto
// (0 = quitar). Los productos que no se mencionan y los combos no se tocan.
// Agregar lo puede hacer cualquier usuario; reducir o quitar solo un admin.
const updateItems = async (req, res) => {
  const client = await pool.connect();
  try {
    const wanted = new Map();
    for (const it of req.body.items || []) {
      const qty = parseInt(it.quantity, 10);
      if (!it.product_id || !Number.isInteger(qty) || qty < 0 || qty > 9999)
        throw new Error("Producto o cantidad inválidos");
      wanted.set(it.product_id, qty);
    }
    if (wanted.size === 0) throw new Error("No hay cambios que guardar");

    await client.query("BEGIN");
    const debtRes = await client.query(
      "SELECT * FROM debts WHERE id = $1 AND status = 'pendiente' FOR UPDATE",
      [req.params.id],
    );
    const debt = debtRes.rows[0];
    if (!debt) throw new Error("Pendiente no encontrado o ya fue cobrado");

    const linesRes = await client.query(
      "SELECT * FROM sale_items WHERE sale_id = $1 AND product_sku <> 'COMBO' ORDER BY created_at",
      [debt.sale_id],
    );
    const existing = new Map(); // product_id -> { qty, unit_price, lines }
    for (const l of linesRes.rows) {
      const e = existing.get(l.product_id) || {
        qty: 0,
        unit_price: l.unit_price,
        lines: [],
      };
      e.qty += l.quantity;
      e.lines.push(l);
      existing.set(l.product_id, e);
    }

    const isAdmin = req.user.role === "admin";
    let changed = false;

    for (const [productId, newQty] of wanted) {
      const old = existing.get(productId);
      const oldQty = old ? old.qty : 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;
      changed = true;

      if (delta < 0 && !isAdmin)
        throw new Error("Solo un administrador puede quitar o reducir productos");

      const prodRes = await client.query(
        "SELECT id, name, sku, sale_price, stock, is_active FROM products WHERE id = $1 FOR UPDATE",
        [productId],
      );
      const product = prodRes.rows[0];
      if (!product) throw new Error("Producto no encontrado");
      if (delta > 0) {
        if (!product.is_active)
          throw new Error(`El producto ${product.name} no está activo`);
        if (product.stock < delta)
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`,
          );
      }

      // El precio ya cobrado se respeta; un producto nuevo entra al precio actual
      const unitPrice = old ? parseFloat(old.unit_price) : parseFloat(product.sale_price);

      if (old) {
        await client.query("DELETE FROM sale_items WHERE id = ANY($1::uuid[])", [
          old.lines.map((l) => l.id),
        ]);
      }
      if (newQty > 0) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            debt.sale_id,
            product.id,
            old ? old.lines[0].product_name : product.name,
            old ? old.lines[0].product_sku : product.sku,
            newQty,
            unitPrice,
            unitPrice * newQty,
          ],
        );
      }

      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [
        delta,
        product.id,
      ]);
      await client.query(
        `INSERT INTO inventory_movements (product_id, user_id, type, quantity, reason, reference_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          product.id,
          req.user.id,
          delta > 0 ? "venta" : "entrada",
          Math.abs(delta),
          delta > 0
            ? `Producto agregado a pendiente de ${debt.customer_name}`
            : `Producto quitado de pendiente de ${debt.customer_name}`,
          debt.sale_id,
        ],
      );
    }

    if (!changed) throw new Error("No hay cambios que guardar");

    const totalRes = await client.query(
      "SELECT COALESCE(SUM(subtotal), 0) AS total, COUNT(*)::int AS n FROM sale_items WHERE sale_id = $1",
      [debt.sale_id],
    );
    if (totalRes.rows[0].n === 0)
      throw new Error(
        "Un pendiente no puede quedar sin productos. Si ya no corresponde, anula la venta.",
      );
    const total = totalRes.rows[0].total;
    await client.query("UPDATE sales SET subtotal = $1, total = $1 WHERE id = $2", [
      total,
      debt.sale_id,
    ]);
    await client.query("UPDATE debts SET amount = $1 WHERE id = $2", [total, debt.id]);

    await client.query("COMMIT");

    const io = getIO();
    if (io) io.emit("inventory-updated", { type: "debt_edited", debtId: debt.id });

    res.json({ message: "Pendiente actualizado", amount: parseFloat(total) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    const forbidden = /administrador/.test(err.message || "");
    res
      .status(forbidden ? 403 : 400)
      .json({ error: err.message || "Error al actualizar el pendiente" });
  } finally {
    client.release();
  }
};

// PATCH /api/debts/customer — corrige nombre/teléfono de una persona en todos sus pendientes.
// Si el nuevo nombre ya existe, los pendientes quedan unidos en un solo grupo.
const updateCustomer = async (req, res) => {
  try {
    const { customer_name, new_name, new_phone } = req.body;
    const name = new_name?.trim();
    if (!customer_name?.trim() || !name)
      return res.status(400).json({ error: "Falta el nombre del cliente" });

    const sets = ["customer_name = $2"];
    const params = [customer_name.trim(), name];
    if (new_phone !== undefined) {
      sets.push("customer_phone = $3");
      params.push(new_phone?.trim() || null);
    }
    const { rowCount } = await pool.query(
      `UPDATE debts SET ${sets.join(", ")}
       WHERE status = 'pendiente' AND ${NAME_KEY} = lower(trim($1))`,
      params,
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Ese cliente no tiene pendientes" });
    res.json({ message: "Cliente actualizado", updated: rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el cliente" });
  }
};

module.exports = { list, pay, payCustomer, customers, updateItems, updateCustomer };
