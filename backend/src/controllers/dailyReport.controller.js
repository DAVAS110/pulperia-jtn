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
    // ✅ FIX: leer date_from y date_to, con fallback a date (compatibilidad)
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Costa_Rica",
    });
    const dateFrom = req.query.date_from || req.query.date || today;
    const dateTo = req.query.date_to || req.query.date || today;

    console.log("[dailyReport] Rango:", dateFrom, "->", dateTo);

    const [salesRes, salesDetailRes, movRes, treasuryRes, lowStockRes] =
      await Promise.all([
        // Resumen por método de pago
        pool.query(
          `
          SELECT payment_method, COUNT(*)::int AS count, SUM(total)::numeric AS total
          FROM sales
          WHERE DATE(created_at AT TIME ZONE 'America/Costa_Rica') BETWEEN $1 AND $2
            AND status = 'completada'
          GROUP BY payment_method
          `,
          [dateFrom, dateTo],
        ),

        // Detalle completo de cada venta con sus productos
        pool.query(
          `
          SELECT
            s.id,
            DATE(s.created_at AT TIME ZONE 'America/Costa_Rica') AS fecha,
            TO_CHAR(s.created_at AT TIME ZONE 'America/Costa_Rica', 'HH12:MI AM') AS hora,
            s.total,
            s.payment_method,
            s.received_by,
            s.sinpe_description,
            u.name AS cajero,
            json_agg(
              json_build_object(
                'product_name', si.product_name,
                'quantity',     si.quantity,
                'unit_price',   si.unit_price,
                'subtotal',     si.subtotal
              ) ORDER BY si.product_name
            ) AS items
          FROM sales s
          LEFT JOIN users u ON u.id = s.user_id
          LEFT JOIN sale_items si ON si.sale_id = s.id
          WHERE DATE(s.created_at AT TIME ZONE 'America/Costa_Rica') BETWEEN $1 AND $2
            AND s.status = 'completada'
          GROUP BY s.id, u.name
          ORDER BY s.created_at ASC
          `,
          [dateFrom, dateTo],
        ),

        // Movimientos de inventario
        pool.query(
          `
          SELECT m.*, p.name AS product_name, p.sku, u.name AS user_name
          FROM inventory_movements m
          JOIN products p ON p.id = m.product_id
          LEFT JOIN users u ON u.id = m.user_id
          WHERE DATE(m.created_at AT TIME ZONE 'America/Costa_Rica') BETWEEN $1 AND $2
          ORDER BY m.created_at DESC
          `,
          [dateFrom, dateTo],
        ),

        // Saldo tesorería
        pool.query("SELECT * FROM treasury_accounts ORDER BY type"),

        // Bajo stock
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
      date: dateFrom,
      date_from: dateFrom,
      date_to: dateTo,
      sales_by_method: salesRes.rows,
      sales_detail: salesDetailRes.rows,
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
      process.env.RESEND_FROM || "Pulpería JTN <onboarding@resend.dev>";

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
