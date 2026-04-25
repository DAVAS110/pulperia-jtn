const { pool } = require("../config/database");
const { Resend } = require("resend");

const getResend = () => {
  if (!process.env.RESEND_API_KEY)
    throw new Error("RESEND_API_KEY no configurado en .env");
  return new Resend(process.env.RESEND_API_KEY);
};

// ─── GET /api/reports/daily ───────────────────────────────
const dailyReport = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [salesRes, movRes, treasuryRes, lowStockRes] = await Promise.all([
      pool.query(
        `
        SELECT payment_method, COUNT(*)::int AS count, SUM(total)::numeric AS total
        FROM sales
        WHERE DATE(created_at) = $1 AND status = 'completada'
        GROUP BY payment_method
      `,
        [date],
      ),

      pool.query(
        `
        SELECT m.*, p.name AS product_name, p.sku, u.name AS user_name
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        LEFT JOIN users u ON u.id = m.user_id
        WHERE DATE(m.created_at) = $1
        ORDER BY m.created_at DESC
      `,
        [date],
      ),

      pool.query("SELECT * FROM treasury_accounts ORDER BY type"),

      pool.query(`
        SELECT p.name, p.sku, p.stock, p.min_stock, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = true AND p.stock <= p.min_stock
        ORDER BY p.stock ASC
        LIMIT 20
      `),
    ]);

    const totalSales = salesRes.rows.reduce(
      (s, r) => s + parseFloat(r.total),
      0,
    );
    const totalCount = salesRes.rows.reduce((s, r) => s + r.count, 0);

    res.json({
      date,
      sales_by_method: salesRes.rows,
      total_sales: totalSales,
      total_count: totalCount,
      movements: movRes.rows,
      treasury: treasuryRes.rows,
      low_stock: lowStockRes.rows,
      generated_at: new Date().toISOString(),
      generated_by: req.user.name,
    });
  } catch (err) {
    console.error("Daily report error:", err);
    res.status(500).json({ error: "Error al generar reporte diario" });
  }
};

// ─── POST /api/reports/send-email ─────────────────────────
const sendEmail = async (req, res) => {
  try {
    const { to, subject, html, pdfBase64, filename, date } = req.body;

    if (!to)
      return res.status(400).json({ error: "El destinatario es requerido" });

    const resend = getResend();
    const from =
      process.env.RESEND_FROM || "Pulperia JTN <onboarding@resend.dev>";

    await resend.emails.send({
      from,
      to: [to],
      subject:
        subject ||
        `Cierre de Caja — ${date || new Date().toLocaleDateString("es-CR")}`,
      html:
        html ||
        `<p>Adjunto el informe del día <strong>${date}</strong>. Generado por: ${req.user.name}</p>`,
      attachments: pdfBase64
        ? [
            {
              filename: filename || `cierre-caja-${date}.pdf`,
              content: pdfBase64,
            },
          ]
        : [],
    });

    res.json({ message: `Informe enviado a ${to}` });
  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({
      error: "Error al enviar: " + (err.message || "Error desconocido"),
    });
  }
};

module.exports = { dailyReport, sendEmail };
