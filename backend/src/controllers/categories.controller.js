const { pool } = require('../config/database');

// GET /api/categories
const list = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

// POST /api/categories
const create = async (req, res) => {
  try {
    const { name, color = '#3498db' } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const { rows } = await pool.query(
      'INSERT INTO categories (name, color) VALUES ($1, $2) RETURNING *',
      [name.trim(), color]
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

// PUT /api/categories/:id
const update = async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows } = await pool.query(
      `UPDATE categories SET name = COALESCE($1, name), color = COALESCE($2, color)
       WHERE id = $3 RETURNING *`,
      [name?.trim(), color, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ category: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

// DELETE /api/categories/:id
const remove = async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

module.exports = { list, create, update, remove };
