const { pool } = require("../config/database");

// GET /api/sales
const list = async (req, res) => {
  try {
    const { page = 1, limit = 50, date_from, date_to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ["s.status = 'completada'"];

    if (date_from) {
      params.push(date_from);
      conditions.push(`s.created_at >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to + " 23:59:59");
      conditions.push(`s.created_at <= $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(
      `
      SELECT s.id, s.total, s.subtotal, s.payment_method, s.cash_received,
             s.change_given, s.sinpe_description, s.sinpe_photo, s.received_by,
             s.notes, s.status, s.created_at,
             u.name AS user_name,
             json_agg(json_build_object(
               'id', si.id, 'product_name', si.product_name, 'product_sku', si.product_sku,
               'quantity', si.quantity, 'unit_price', si.unit_price, 'subtotal', si.subtotal
             )) AS items
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      ${where}
      GROUP BY s.id, u.name
      ORDER BY s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
      params,
    );

    const countParams = params.slice(0, -2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM sales s ${where}`,
      countParams,
    );

    res.json({ sales: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener ventas" });
  }
};

// POST /api/sales
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      items,
      payment_method,
      cash_received,
      sinpe_description,
      sinpe_photo,
      received_by,
      notes,
    } = req.body;

    if (!items || !items.length)
      return res
        .status(400)
        .json({ error: "Se requiere al menos un producto" });
    if (!payment_method)
      return res.status(400).json({ error: "Método de pago requerido" });
    if (payment_method === "sinpe" && !received_by?.trim())
      return res
        .status(400)
        .json({ error: "Debe indicar quién recibió el SINPE" });

    let subtotal = 0;
    const enrichedItems = [];

    for (const item of items) {
      const { rows } = await client.query(
        "SELECT * FROM products WHERE id = $1 AND is_active = true FOR UPDATE",
        [item.product_id],
      );
      const product = rows[0];
      if (!product)
        throw new Error(`Producto ${item.product_id} no encontrado`);
      if (product.stock < item.quantity)
        throw new Error(
          `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`,
        );

      const itemSubtotal =
        parseFloat(product.sale_price) * parseInt(item.quantity);
      subtotal += itemSubtotal;
      enrichedItems.push({
        product,
        quantity: parseInt(item.quantity),
        subtotal: itemSubtotal,
      });
    }

    const total = subtotal;
    const changeGiven =
      payment_method === "efectivo" && cash_received
        ? parseFloat(cash_received) - total
        : null;

    if (
      payment_method === "efectivo" &&
      cash_received &&
      parseFloat(cash_received) < total
    )
      throw new Error("El efectivo recibido es menor al total");

    const saleRes = await client.query(
      `INSERT INTO sales (user_id, total, subtotal, payment_method, cash_received, change_given,
                          sinpe_description, sinpe_photo, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.user.id,
        total,
        subtotal,
        payment_method,
        cash_received ? parseFloat(cash_received) : null,
        changeGiven,
        payment_method === "sinpe" ? sinpe_description || null : null,
        payment_method === "sinpe" ? sinpe_photo || null : null,
        received_by?.trim() || null,
        notes || null,
      ],
    );
    const sale = saleRes.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          sale.id,
          item.product.id,
          item.product.name,
          item.product.sku,
          item.quantity,
          item.product.sale_price,
          item.subtotal,
        ],
      );
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.product.id],
      );
      await client.query(
        `INSERT INTO inventory_movements (product_id, user_id, type, quantity, reason, reference_id)
         VALUES ($1,$2,'venta',$3,'Venta registrada',$4)`,
        [item.product.id, req.user.id, item.quantity, sale.id],
      );
    }

    // Auto-update treasury
    const accountType = payment_method === "efectivo" ? "caja" : "sinpe";
    await client.query(
      "UPDATE treasury_accounts SET balance = balance + $1, updated_at = NOW() WHERE type = $2",
      [total, accountType],
    );
    await client.query(
      `
      INSERT INTO treasury_movements (account_type, direction, amount, category, description, reference_sale_id, user_id)
      VALUES ($1, 'entrada', $2, 'venta', 'Venta registrada', $3, $4)
    `,
      [accountType, total, sale.id, req.user.id],
    );

    await client.query("COMMIT");

    // Return full sale including sinpe_photo
    const fullSale = await pool.query(
      `
      SELECT s.id, s.total, s.subtotal, s.payment_method, s.cash_received,
             s.change_given, s.sinpe_description, s.sinpe_photo, s.received_by,
             s.notes, s.status, s.created_at, u.name AS user_name,
             json_agg(json_build_object(
               'product_name', si.product_name, 'quantity', si.quantity,
               'unit_price', si.unit_price, 'subtotal', si.subtotal
             )) AS items
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, u.name
    `,
      [sale.id],
    );

    res.status(201).json({ sale: fullSale.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "Error al registrar venta" });
  } finally {
    client.release();
  }
};

// DELETE /api/sales/:id
const cancel = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saleRes = await client.query(
      "SELECT * FROM sales WHERE id = $1 AND status = 'completada'",
      [req.params.id],
    );
    if (!saleRes.rows[0])
      return res
        .status(404)
        .json({ error: "Venta no encontrada o ya anulada" });

    const itemsRes = await client.query(
      "SELECT * FROM sale_items WHERE sale_id = $1",
      [req.params.id],
    );
    for (const item of itemsRes.rows) {
      await client.query(
        "UPDATE products SET stock = stock + $1 WHERE id = $2",
        [item.quantity, item.product_id],
      );
      await client.query(
        `INSERT INTO inventory_movements (product_id, user_id, type, quantity, reason, reference_id)
         VALUES ($1,$2,'entrada',$3,'Anulación de venta',$4)`,
        [item.product_id, req.user.id, item.quantity, req.params.id],
      );
    }

    await client.query("UPDATE sales SET status = 'anulada' WHERE id = $1", [
      req.params.id,
    ]);

    const saleData = saleRes.rows[0];
    const cancelAccountType =
      saleData.payment_method === "efectivo" ? "caja" : "sinpe";
    await client.query(
      "UPDATE treasury_accounts SET balance = balance - $1, updated_at = NOW() WHERE type = $2",
      [saleData.total, cancelAccountType],
    );
    await client.query(
      `
      INSERT INTO treasury_movements (account_type, direction, amount, category, description, reference_sale_id, user_id)
      VALUES ($1, 'salida', $2, 'anulacion', 'Anulación de venta', $3, $4)
    `,
      [cancelAccountType, saleData.total, req.params.id, req.user.id],
    );

    await client.query("COMMIT");
    res.json({ message: "Venta anulada correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al anular venta" });
  } finally {
    client.release();
  }
};

module.exports = { list, create, cancel };
