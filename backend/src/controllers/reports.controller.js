const { pool } = require('../config/database');

// GET /api/reports/dashboard
const dashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [productsRes, stockValueRes, lowStockRes, salesTodayRes, activityRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int FROM products WHERE is_active = true"),
      pool.query("SELECT COALESCE(SUM(sale_price * stock), 0)::numeric AS total FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*)::int FROM products WHERE is_active = true AND stock <= min_stock"),
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
      sales_today: { total: parseFloat(salesTodayRes.rows[0].total), count: salesTodayRes.rows[0].count },
      recent_activity: activityRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};

// GET /api/reports/sales
const salesReport = async (req, res) => {
  try {
    const { date_from, date_to, group_by = 'day' } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);

    const truncFn = group_by === 'month' ? 'month' : 'day';

    const { rows: salesByDate } = await pool.query(`
      SELECT DATE_TRUNC($1, created_at) AS period,
             SUM(total)::numeric AS total,
             COUNT(*)::int AS count
      FROM sales
      WHERE status = 'completada' AND created_at >= $2 AND created_at <= ($3::date + interval '1 day')
      GROUP BY period ORDER BY period
    `, [truncFn, from, to]);

    const { rows: topProducts } = await pool.query(`
      SELECT si.product_name, si.product_sku,
             SUM(si.quantity)::int AS total_quantity,
             SUM(si.subtotal)::numeric AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completada' AND s.created_at >= $1 AND s.created_at <= ($2::date + interval '1 day')
      GROUP BY si.product_name, si.product_sku
      ORDER BY total_quantity DESC LIMIT 10
    `, [from, to]);

    const { rows: paymentMethods } = await pool.query(`
      SELECT payment_method, COUNT(*)::int AS count, SUM(total)::numeric AS total
      FROM sales
      WHERE status = 'completada' AND created_at >= $1 AND created_at <= ($2::date + interval '1 day')
      GROUP BY payment_method
    `, [from, to]);

    res.json({ sales_by_date: salesByDate, top_products: topProducts, payment_methods: paymentMethods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte de ventas' });
  }
};

// GET /api/reports/inventory
const inventoryReport = async (req, res) => {
  try {
    const { rows: products } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.color AS category_color,
             (p.stock <= p.min_stock) AS low_stock,
             (p.sale_price * p.stock)::numeric AS stock_value,
             (p.cost_price * p.stock)::numeric AS cost_value
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = true ORDER BY p.name
    `);

    const { rows: byCategory } = await pool.query(`
      SELECT c.name AS category_name, c.color,
             COUNT(p.id)::int AS product_count,
             SUM(p.stock * p.sale_price)::numeric AS total_value
      FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.is_active=true
      GROUP BY c.id ORDER BY total_value DESC
    `);

    res.json({ products, by_category: byCategory });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte de inventario' });
  }
};

module.exports = { dashboard, salesReport, inventoryReport };
