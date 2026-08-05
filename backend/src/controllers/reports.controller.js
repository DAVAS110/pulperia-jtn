const { pool } = require('../config/database');

// GET /api/reports/dashboard
const dashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [productsRes, stockValueRes, lowStockRes, expiringRes, salesTodayRes, activityRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int FROM products WHERE is_active = true"),
      pool.query("SELECT COALESCE(SUM(sale_price * stock), 0)::numeric AS total FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock <= min_stock"),
      pool.query(`SELECT COUNT(*)::int FROM products
                  WHERE is_active = true AND expiration_date IS NOT NULL
                    AND expiration_date <= CURRENT_DATE + INTERVAL '14 days'`),
      pool.query(`SELECT COALESCE(SUM(total),0)::numeric AS total, COUNT(*)::int AS count
                  FROM sales WHERE DATE(created_at) = $1 AND status = 'completada'`, [today]),
      pool.query(`
        (SELECT 'movimiento' AS type, m.type AS sub_type, p.name AS product_name, m.quantity, m.reason,
                u.name AS user_name, m.created_at
         FROM inventory_movements m JOIN products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.user_id
         ORDER BY m.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'venta' AS type, s.payment_method AS sub_type, NULL AS product_name,
                NULL AS quantity, CONCAT('₡',s.total::text) AS reason, u.name AS user_name, s.created_at
         FROM sales s LEFT JOIN users u ON u.id=s.user_id
         WHERE s.status='completada' ORDER BY s.created_at DESC LIMIT 5)
        ORDER BY created_at DESC LIMIT 10
      `)
    ]);

    res.json({
      total_products: productsRes.rows[0].count,
      stock_value: parseFloat(stockValueRes.rows[0].total),
      low_stock_count: lowStockRes.rows[0].count,
      expiring_count: expiringRes.rows[0].count,
      sales_today: { total: parseFloat(salesTodayRes.rows[0].total), count: salesTodayRes.rows[0].count },
      recent_activity: activityRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};

module.exports = { dashboard };
