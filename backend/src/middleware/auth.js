const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

// Caché corto del usuario para no consultar la BD en cada request.
const USER_TTL_MS = 30 * 1000;
const userCache = new Map();
const invalidateUser = (id) => userCache.delete(String(id));

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("auth_token="));

  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=")[1]);
};

const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const key = String(decoded.userId);
    const cached = userCache.get(key);
    let user = cached && cached.exp > Date.now() ? cached.user : null;
    if (!user) {
      const { rows } = await pool.query(
        "SELECT id, name, email, role, is_active FROM users WHERE id = $1",
        [decoded.userId],
      );
      user = rows[0];
      if (user) userCache.set(key, { user, exp: Date.now() + USER_TTL_MS });
    }
    const rows = [user];
    if (!rows[0] || !rows[0].is_active) {
      return res
        .status(401)
        .json({ error: "Usuario no encontrado o inactivo" });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Se requiere rol administrador." });
  }
  next();
};

module.exports = { authenticate, requireAdmin, invalidateUser };
