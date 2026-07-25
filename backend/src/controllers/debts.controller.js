const { pool } = require("../config/database");
const { getIO } = require("../socket");

// GET /api/debts
const list = async (req, res) => {
  try {
    const { status = "pendiente", page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [status, parseInt(limit), offset];

    const { rows } = await pool.query(
      `
      SELECT d.id, d.sale_id, d.customer_name, d.customer_phone, d.amount, d.status,
             d.paid_at, d.paid_payment_method, d.paid_sinpe_description, d.paid_sinpe_photo,
             d.paid_received_by, d.created_at,
             u.name AS created_by_name,
             json_agg(json_build_object(
               'product_name', si.product_name, 'product_sku', si.product_sku,
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

// POST /api/debts/:id/pay
const pay = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { payment_method, cash_received, sinpe_description, sinpe_photo, received_by } =
      req.body;

    const debtRes = await client.query(
      "SELECT * FROM debts WHERE id = $1 AND status = 'pendiente' FOR UPDATE",
      [req.params.id],
    );
    const debt = debtRes.rows[0];
    if (!debt)
      return res
        .status(404)
        .json({ error: "Pendiente no encontrado o ya fue cobrado" });

    const amount = parseFloat(debt.amount);

    if (payment_method === "efectivo" && cash_received != null && parseFloat(cash_received) < amount)
      throw new Error("El efectivo recibido es menor al monto de la deuda");
    if (payment_method === "sinpe" && !received_by?.trim())
      throw new Error("Debe indicar quién recibió el SINPE");

    await client.query(
      `UPDATE debts SET status = 'pagada', paid_at = NOW(), paid_payment_method = $1,
         paid_sinpe_description = $2, paid_sinpe_photo = $3, paid_received_by = $4
       WHERE id = $5`,
      [
        payment_method,
        payment_method === "sinpe" ? sinpe_description || null : null,
        payment_method === "sinpe" ? sinpe_photo || null : null,
        received_by?.trim() || null,
        debt.id,
      ],
    );

    await client.query("UPDATE sales SET status = 'completada' WHERE id = $1", [
      debt.sale_id,
    ]);

    const accountType = payment_method === "efectivo" ? "caja" : "sinpe";
    await client.query(
      "UPDATE treasury_accounts SET balance = balance + $1, updated_at = NOW() WHERE type = $2",
      [amount, accountType],
    );
    await client.query(
      `INSERT INTO treasury_movements (account_type, direction, amount, category, description, reference_sale_id, user_id)
       VALUES ($1, 'entrada', $2, 'cobro_deuda', $3, $4, $5)`,
      [
        accountType,
        amount,
        `Cobro de deuda: ${debt.customer_name}`,
        debt.sale_id,
        req.user.id,
      ],
    );

    await client.query("COMMIT");

    const io = getIO();
    if (io) io.emit("inventory-updated", { type: "debt_paid", debtId: debt.id });

    res.json({ message: "Deuda cobrada correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "Error al cobrar deuda" });
  } finally {
    client.release();
  }
};

module.exports = { list, pay };
