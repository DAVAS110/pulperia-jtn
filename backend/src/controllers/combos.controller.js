const { pool } = require("../config/database");

// GET /api/combos
const list = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'product_id', ci.product_id,
            'quantity', ci.quantity,
            'product_name', p.name,
            'product_sku', p.sku,
            'product_stock', p.stock,
            'product_price', p.sale_price,
            'product_image', p.image_url
          ) ORDER BY p.name
        ) FILTER (WHERE ci.id IS NOT NULL) AS items
      FROM combos c
      LEFT JOIN combo_items ci ON ci.combo_id = c.id
      LEFT JOIN products p ON p.id = ci.product_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ combos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener combos" });
  }
};

// GET /api/combos/all  (incluyendo inactivos, para admin)
const listAll = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'product_id', ci.product_id,
            'quantity', ci.quantity,
            'product_name', p.name,
            'product_sku', p.sku,
            'product_stock', p.stock,
            'product_price', p.sale_price,
            'product_image', p.image_url
          ) ORDER BY p.name
        ) FILTER (WHERE ci.id IS NOT NULL) AS items
      FROM combos c
      LEFT JOIN combo_items ci ON ci.combo_id = c.id
      LEFT JOIN products p ON p.id = ci.product_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ combos: rows });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener combos" });
  }
};

// POST /api/combos
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { name, description, price, image_url, items } = req.body;

    if (!name) return res.status(400).json({ error: "El nombre es requerido" });
    if (!price || price <= 0)
      return res.status(400).json({ error: "El precio debe ser mayor a 0" });
    if (!items || items.length < 2)
      return res
        .status(400)
        .json({ error: "Un combo debe tener al menos 2 productos" });

    const { rows } = await client.query(
      `INSERT INTO combos (name, description, price, image_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description || null, parseFloat(price), image_url || null],
    );
    const combo = rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO combo_items (combo_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [combo.id, item.product_id, parseInt(item.quantity) || 1],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ combo });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al crear combo" });
  } finally {
    client.release();
  }
};

// PUT /api/combos/:id
const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { name, description, price, image_url, is_active, items } = req.body;

    const { rows } = await client.query(
      `UPDATE combos SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        image_url = COALESCE($4, image_url),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [
        name?.trim(),
        description,
        price ? parseFloat(price) : null,
        image_url,
        is_active,
        req.params.id,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: "Combo no encontrado" });

    if (items && items.length >= 2) {
      await client.query("DELETE FROM combo_items WHERE combo_id = $1", [
        req.params.id,
      ]);
      for (const item of items) {
        await client.query(
          `INSERT INTO combo_items (combo_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [req.params.id, item.product_id, parseInt(item.quantity) || 1],
        );
      }
    }

    await client.query("COMMIT");
    res.json({ combo: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al actualizar combo" });
  } finally {
    client.release();
  }
};

// DELETE /api/combos/:id (soft delete)
const remove = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE combos SET is_active = false WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Combo no encontrado" });
    res.json({ message: "Combo eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar combo" });
  }
};

// Verificar stock disponible para un combo
const checkStock = async (client, comboId, quantity = 1) => {
  const { rows } = await client.query(
    `
    SELECT ci.product_id, ci.quantity * $2 AS needed, p.stock, p.name
    FROM combo_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.combo_id = $1
  `,
    [comboId, quantity],
  );

  for (const row of rows) {
    if (row.stock < row.needed) {
      throw new Error(
        `Stock insuficiente de "${row.name}". Disponible: ${row.stock}, necesario: ${row.needed}`,
      );
    }
  }
  return rows;
};

module.exports = { list, listAll, create, update, remove, checkStock };
