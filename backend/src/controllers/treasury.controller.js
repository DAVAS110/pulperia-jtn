const { pool } = require('../config/database');

// GET /api/treasury — saldos actuales + resumen
const getSummary = async (req, res) => {
  try {
    const [accountsRes, recentRes, totalsRes] = await Promise.all([
      pool.query('SELECT * FROM treasury_accounts ORDER BY type'),
      pool.query(`
        SELECT tm.*, u.name AS user_name
        FROM treasury_movements tm
        LEFT JOIN users u ON u.id = tm.user_id
        ORDER BY tm.created_at DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT account_type,
          SUM(CASE WHEN direction='entrada' THEN amount ELSE 0 END) AS total_in,
          SUM(CASE WHEN direction='salida' THEN amount ELSE 0 END)  AS total_out
        FROM treasury_movements
        WHERE created_at >= DATE_TRUNC('month', NOW())
        GROUP BY account_type
      `)
    ]);

    const caja  = accountsRes.rows.find(a => a.type === 'caja')  || { balance: 0 };
    const sinpe = accountsRes.rows.find(a => a.type === 'sinpe') || { balance: 0 };

    res.json({
      caja:  { balance: parseFloat(caja.balance) },
      sinpe: { balance: parseFloat(sinpe.balance) },
      recent_movements: recentRes.rows,
      monthly_totals: totalsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tesorería' });
  }
};

// GET /api/treasury/movements — historial paginado
const listMovements = async (req, res) => {
  try {
    const { account_type, direction, page = 1, limit = 40 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (account_type) { params.push(account_type); conditions.push(`tm.account_type = $${params.length}`); }
    if (direction)    { params.push(direction);     conditions.push(`tm.direction = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(`
      SELECT tm.*, u.name AS user_name
      FROM treasury_movements tm
      LEFT JOIN users u ON u.id = tm.user_id
      ${where}
      ORDER BY tm.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countParams = params.slice(0, -2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM treasury_movements tm ${where}`, countParams
    );

    res.json({ movements: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

// POST /api/treasury/withdraw — retiro/gasto (solo admin)
const withdraw = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { account_type, amount, category, description } = req.body;

    if (!account_type || !amount || !category)
      return res.status(400).json({ error: 'account_type, amount y category son requeridos' });

    const amt = parseFloat(amount);
    if (amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const accRes = await client.query(
      'SELECT * FROM treasury_accounts WHERE type = $1 FOR UPDATE', [account_type]
    );
    const account = accRes.rows[0];
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (parseFloat(account.balance) < amt)
      return res.status(400).json({ error: `Saldo insuficiente. Disponible: ₡${account.balance}` });

    await client.query(
      'UPDATE treasury_accounts SET balance = balance - $1, updated_at = NOW() WHERE type = $2',
      [amt, account_type]
    );

    const { rows } = await client.query(`
      INSERT INTO treasury_movements (account_type, direction, amount, category, description, user_id)
      VALUES ($1, 'salida', $2, $3, $4, $5) RETURNING *
    `, [account_type, amt, category, description || null, req.user.id]);

    await client.query('COMMIT');
    res.status(201).json({ movement: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar retiro' });
  } finally {
    client.release();
  }
};

// POST /api/treasury/deposit — ingreso manual (solo admin)
const deposit = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { account_type, amount, category, description } = req.body;

    if (!account_type || !amount || !category)
      return res.status(400).json({ error: 'account_type, amount y category son requeridos' });

    const amt = parseFloat(amount);
    if (amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    await client.query(
      'UPDATE treasury_accounts SET balance = balance + $1, updated_at = NOW() WHERE type = $2',
      [amt, account_type]
    );

    const { rows } = await client.query(`
      INSERT INTO treasury_movements (account_type, direction, amount, category, description, user_id)
      VALUES ($1, 'entrada', $2, $3, $4, $5) RETURNING *
    `, [account_type, amt, category, description || null, req.user.id]);

    await client.query('COMMIT');
    res.status(201).json({ movement: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar ingreso' });
  } finally {
    client.release();
  }
};

module.exports = { getSummary, listMovements, withdraw, deposit };