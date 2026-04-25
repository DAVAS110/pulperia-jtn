const { pool } = require('../config/database');

// GET /api/inventory
const list = async (req, res) => {
  try {
    const { product_id, type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (product_id) { params.push(product_id); conditions.push(`m.product_id = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`m.type = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(`
      SELECT m.*, p.name AS product_name, p.sku AS product_sku,
             u.name AS user_name
      FROM inventory_movements m
      JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countParams = params.slice(0, -2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM inventory_movements m JOIN products p ON p.id = m.product_id ${where}`,
      countParams
    );

    res.json({ movements: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

// POST /api/inventory
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { product_id, type, quantity, reason } = req.body;
    if (!product_id || !type || !quantity)
      return res.status(400).json({ error: 'product_id, type y quantity son requeridos' });

    const qty = parseInt(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'La cantidad debe ser positiva' });

    const prodRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
    const product = prodRes.rows[0];
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let stockDelta = 0;
    if (type === 'entrada') stockDelta = qty;
    else if (type === 'salida' || type === 'venta' || type === 'pérdida') {
      if (product.stock < qty)
        return res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.stock}` });
      stockDelta = -qty;
    } else if (type === 'ajuste') {
      stockDelta = qty - product.stock; // absolute adjustment
    }

    await client.query(
      'UPDATE products SET stock = stock + $1 WHERE id = $2',
      [stockDelta, product_id]
    );

    const { rows } = await client.query(
      `INSERT INTO inventory_movements (product_id, user_id, type, quantity, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [product_id, req.user.id, type, qty, reason || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ movement: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al registrar movimiento' });
  } finally {
    client.release();
  }
};

module.exports = { list, create };
