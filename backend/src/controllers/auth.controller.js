const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login  — público
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });

    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, role, is_active, last_login FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.is_active)
      return res.status(401).json({ error: 'Credenciales incorrectas o cuenta inactiva' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  res.json({ user: req.user });
};

// GET /api/auth/users  (admin only)
const listUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, last_login, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/auth/users  (admin only) — crear usuario
const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'employee' } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows[0])
      return res.status(409).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash,
       role === 'admin' ? 'admin' : 'employee']
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/auth/users/:id  (admin only) — editar
const updateUser = async (req, res) => {
  try {
    const { name, role, is_active, password } = req.body;
    const { id } = req.params;

    // Prevent admin from deactivating/deleting themselves
    if (id === req.user.id && is_active === false)
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    if (id === req.user.id && role && role !== 'admin')
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });

    let passwordUpdate = '';
    const params = [name, role, is_active, id];

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      const hash = await bcrypt.hash(password, 12);
      passwordUpdate = ', password_hash = $5';
      params.splice(3, 0, hash); // insert before id
      params[params.length - 1] = id;
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           is_active = COALESCE($3, is_active)
           ${password ? ', password_hash = $5' : ''}
       WHERE id = $4
       RETURNING id, name, email, role, is_active, last_login, created_at`,
      password
        ? [name, role, is_active, id, await bcrypt.hash(password, 12)]
        : [name, role, is_active, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/auth/users/:id  (admin only) — eliminar permanente
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id)
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name', [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: `Usuario "${rows[0].name}" eliminado permanentemente` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

module.exports = { login, me, listUsers, createUser, updateUser, deleteUser };