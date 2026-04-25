const { pool } = require('../config/database');

// GET /api/products
const list = async (req, res) => {
  try {
    const { search, category_id, status, sort = 'name', order = 'asc', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ['p.is_active = true'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
    }
    if (category_id) {
      params.push(category_id);
      conditions.push(`p.category_id = $${params.length}`);
    }
    if (status === 'bajo') {
      conditions.push('p.stock <= p.min_stock');
    } else if (status === 'ok') {
      conditions.push('p.stock > p.min_stock');
    }

    const allowedSorts = { name: 'p.name', stock: 'p.stock', sale_price: 'p.sale_price', created_at: 'p.created_at' };
    const sortCol = allowedSorts[sort] || 'p.name';
    const sortDir = order === 'desc' ? 'DESC' : 'ASC';

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(parseInt(limit), offset);
    const query = `
      SELECT p.*, c.name AS category_name, c.color AS category_color,
             (p.stock <= p.min_stock) AS low_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countParams = params.slice(0, -2);
    const countQuery = `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      products: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// GET /api/products/:id
const getOne = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.color AS category_color
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// GET /api/products/sku/:sku
const getBySku = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.color AS category_color
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.sku = $1 AND p.is_active = true
    `, [req.params.sku]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// POST /api/products
const create = async (req, res) => {
  try {
    const { name, sku, category_id, sale_price, cost_price, stock, min_stock, image_url } = req.body;
    if (!name || !sku) return res.status(400).json({ error: 'Nombre y SKU son requeridos' });

    const skuCheck = await pool.query('SELECT id FROM products WHERE sku = $1', [sku.trim()]);
    if (skuCheck.rows[0]) return res.status(409).json({ error: 'El SKU ya existe' });

    const { rows } = await pool.query(`
      INSERT INTO products (name, sku, category_id, sale_price, cost_price, stock, min_stock, image_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [name.trim(), sku.trim().toUpperCase(), category_id || null,
        parseFloat(sale_price) || 0, parseFloat(cost_price) || 0,
        parseInt(stock) || 0, parseInt(min_stock) || 5, image_url || null]);

    // Log movement if initial stock > 0
    if (parseInt(stock) > 0) {
      await pool.query(
        `INSERT INTO inventory_movements (product_id, user_id, type, quantity, reason)
         VALUES ($1,$2,'entrada',$3,'Stock inicial')`,
        [rows[0].id, req.user.id, parseInt(stock)]
      );
    }
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// PUT /api/products/:id
const update = async (req, res) => {
  try {
    const { name, sku, category_id, sale_price, cost_price, stock, min_stock, image_url, is_active } = req.body;
    const { rows } = await pool.query(`
      UPDATE products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        category_id = COALESCE($3, category_id),
        sale_price = COALESCE($4, sale_price),
        cost_price = COALESCE($5, cost_price),
        stock = COALESCE($6, stock),
        min_stock = COALESCE($7, min_stock),
        image_url = COALESCE($8, image_url),
        is_active = COALESCE($9, is_active)
      WHERE id = $10 RETURNING *
    `, [name?.trim(), sku?.trim().toUpperCase(), category_id,
        sale_price != null ? parseFloat(sale_price) : null,
        cost_price != null ? parseFloat(cost_price) : null,
        stock != null ? parseInt(stock) : null,
        min_stock != null ? parseInt(min_stock) : null,
        image_url, is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// DELETE /api/products/:id  (soft delete)
const remove = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

module.exports = { list, getOne, getBySku, create, update, remove };
