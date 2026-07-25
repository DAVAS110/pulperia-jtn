const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

const parseMaxAge = (value) => {
  const text = String(value || "7d").trim();
  const match = text.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier =
    unit === "s"
      ? 1000
      : unit === "m"
        ? 60000
        : unit === "h"
          ? 3600000
          : 86400000;
  return amount * multiplier;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_MAX_AGE = parseMaxAge(JWT_EXPIRES_IN);
const isProduction = process.env.NODE_ENV === "production";

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const getCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: JWT_MAX_AGE,
  path: "/",
});

// POST /api/auth/login  — público
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email y contraseña son requeridos" });

    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash, role, is_active, last_login FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    const user = rows[0];
    if (!user || !user.is_active)
      return res
        .status(401)
        .json({ error: "Credenciales incorrectas o cuenta inactiva" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Credenciales incorrectas" });

    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [
      user.id,
    ]);

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.cookie("auth_token", token, getCookieOptions());
    res.json({ user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const logout = async (req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.json({ message: "Sesión cerrada" });
};

// GET /api/auth/me
const me = async (req, res) => {
  res.json({ user: req.user });
};

// GET /api/auth/users  (admin only)
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, name, email, role, is_active, last_login, created_at
         FROM users 
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int FROM users`),
    ]);

    res.json({
      users: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/auth/users  (admin only) — crear usuario
const createUser = async (req, res) => {
  try {
    const { name, email, password, role = "employee" } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: "Nombre, email y contraseña son requeridos" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows[0])
      return res.status(409).json({ error: "El email ya está registrado" });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        hash,
        role === "admin" ? "admin" : "employee",
      ],
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/auth/users/:id  (admin only) — editar
const updateUser = async (req, res) => {
  try {
    const { name, role, is_active, password } = req.body;
    const { id } = req.params;

    // Prevent admin from deactivating/deleting themselves
    if (id === req.user.id && is_active === false)
      return res
        .status(400)
        .json({ error: "No puedes desactivar tu propia cuenta" });
    if (id === req.user.id && role && role !== "admin")
      return res.status(400).json({ error: "No puedes cambiar tu propio rol" });

    const params = [name, role, is_active, id];
    if (password) {
      if (password.length < 6)
        return res
          .status(400)
          .json({ error: "La contraseña debe tener al menos 6 caracteres" });
      params.push(await bcrypt.hash(password, 12));
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           is_active = COALESCE($3, is_active)
           ${password ? ", password_hash = $5" : ""}
       WHERE id = $4
       RETURNING id, name, email, role, is_active, last_login, created_at`,
      params,
    );
    if (!rows[0])
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// DELETE /api/auth/users/:id  (admin only) — eliminar permanente
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id)
      return res
        .status(400)
        .json({ error: "No puedes eliminar tu propia cuenta" });

    const { rows } = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, name",
      [id],
    );
    if (!rows[0])
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
      message: `Usuario "${rows[0].name}" eliminado permanentemente`,
    });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
};

module.exports = {
  login,
  logout,
  me,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};
