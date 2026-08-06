const { pool } = require("../config/database");

const STATUSES = ["programado", "cumplido", "cambiado", "ausente"];

// GET /api/shifts?month=YYYY-MM
const list = async (req, res) => {
  try {
    const { month } = req.query;
    if (!/^\d{4}-\d{2}$/.test(month || ""))
      return res.status(400).json({ error: "Parámetro month inválido (YYYY-MM)" });

    const { rows } = await pool.query(
      `
      SELECT s.id, s.shift_date, s.user_id, s.status, s.note, s.created_at,
             u.name AS user_name
      FROM shifts s
      JOIN users u ON u.id = s.user_id
      WHERE s.shift_date >= to_date($1, 'YYYY-MM')
        AND s.shift_date < (to_date($1, 'YYYY-MM') + INTERVAL '1 month')
      ORDER BY s.shift_date, u.name
    `,
      [month],
    );

    res.json({ shifts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener horarios" });
  }
};

// GET /api/shifts/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// Conteo agregado por persona (turnos, cumplidos, ausencias, cambios) —
// nunca trae las filas en crudo, así que sirve igual de rápido para un
// mes que para un año completo.
const summary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(date_to || ""))
      return res.status(400).json({ error: "date_from / date_to inválidos (YYYY-MM-DD)" });

    const { rows } = await pool.query(
      `
      SELECT u.id AS user_id, u.name,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE s.status = 'cumplido')::int AS cumplido,
             COUNT(*) FILTER (WHERE s.status = 'ausente')::int AS ausente,
             COUNT(*) FILTER (WHERE s.status = 'cambiado')::int AS cambiado
      FROM shifts s
      JOIN users u ON u.id = s.user_id
      WHERE s.shift_date >= $1 AND s.shift_date <= $2
      GROUP BY u.id, u.name
      ORDER BY total DESC
    `,
      [date_from, date_to],
    );

    res.json({ summary: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el resumen" });
  }
};

// POST /api/shifts
const create = async (req, res) => {
  try {
    const { shift_date, user_id, status, note } = req.body;
    if (!shift_date || !user_id)
      return res.status(400).json({ error: "Fecha y empleado son requeridos" });
    if (status && !STATUSES.includes(status))
      return res.status(400).json({ error: "Estado inválido" });

    const { rows } = await pool.query(
      `INSERT INTO shifts (shift_date, user_id, status, note, created_by)
       VALUES ($1, $2, COALESCE($3, 'programado'), $4, $5)
       RETURNING id`,
      [shift_date, user_id, status || null, note || null, req.user.id],
    );

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Esa persona ya está asignada ese día" });
    console.error(err);
    res.status(500).json({ error: "Error al registrar el turno" });
  }
};

// PUT /api/shifts/:id
const update = async (req, res) => {
  try {
    const { status, note, user_id } = req.body;
    if (status && !STATUSES.includes(status))
      return res.status(400).json({ error: "Estado inválido" });

    const { rows } = await pool.query(
      `UPDATE shifts SET
         status = COALESCE($1, status),
         note = COALESCE($2, note),
         user_id = COALESCE($3, user_id),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [status || null, note ?? null, user_id || null, req.params.id],
    );

    if (!rows[0]) return res.status(404).json({ error: "Turno no encontrado" });
    res.json({ id: rows[0].id });
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Esa persona ya está asignada ese día" });
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el turno" });
  }
};

// DELETE /api/shifts/:id
const remove = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM shifts WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Turno no encontrado" });
    res.json({ message: "Turno eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el turno" });
  }
};

module.exports = { list, summary, create, update, remove };
