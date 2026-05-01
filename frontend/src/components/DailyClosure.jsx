import React, { useState } from "react";
import { reportsAPI } from "../services/api";
import { Modal } from "./ui";
import { toast } from "../store/toastStore";
import { fmt, fmtDate, fmtDateTime } from "../utils/helpers";

const MOVEMENT_LABELS = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  pérdida: "Pérdida",
  venta: "Venta",
  anulacion: "Anulación",
};

export default function DailyClosure() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [email, setEmail] = useState("vargasariasdavid110@gmail.com");
  const [sending, setSending] = useState(false);

  const load = async (d) => {
    setLoading(true);
    try {
      const { data: res } = await reportsAPI.daily({ date: d || date });
      setData(res);
    } catch {
      toast.error("Error al cargar datos del día");
    } finally {
      setLoading(false);
    }
  };

  const openModal = async () => {
    setOpen(true);
    setData(null);
    await load();
  };

  const generatePDF = () => {
    if (!data || !window.jspdf) {
      toast.error("jsPDF no está cargado. Agrega los scripts en index.html");
      return null;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const W = doc.internal.pageSize.getWidth();
    let y = 0;

    const addPage = () => {
      doc.addPage();
      y = 18;
    };
    const checkSpace = (needed) => {
      if (y + needed > 270) addPage();
    };

    // ── HEADER ──────────────────────────────────────────────
    doc.setFillColor(45, 21, 7);
    doc.rect(0, 0, W, 32, "F");
    doc.setFillColor(200, 87, 10);
    doc.rect(0, 28, W, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Pulpería JTN", 14, 13);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Cierre de Caja — ${fmtDate(data.date)}`, 14, 22);
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(
      `Generado: ${fmtDateTime(data.generated_at)} · Por: ${data.generated_by}`,
      W - 14,
      22,
      { align: "right" },
    );

    y = 42;
    doc.setTextColor(26, 18, 8);

    // ── SECCIÓN 1: RESUMEN EJECUTIVO ─────────────────────────
    doc.setFillColor(245, 240, 232);
    doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 87, 10);
    doc.text("RESUMEN DEL DÍA", 18, y + 5.5);
    doc.setTextColor(26, 18, 8);
    y += 13;

    // Cards de resumen en fila
    const cardW = (W - 28 - 8) / 3;
    const cards = [
      {
        label: "Total Ventas",
        value: fmt(data.total_sales),
        color: [200, 87, 10],
      },
      {
        label: "Transacciones",
        value: data.total_count.toString(),
        color: [45, 122, 79],
      },
      {
        label: "Alertas Stock",
        value:
          data.low_stock?.length > 0 ? `⚠ ${data.low_stock.length}` : "✓ OK",
        color: data.low_stock?.length > 0 ? [192, 57, 43] : [45, 122, 79],
      },
    ];

    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...card.color);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, 18, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 90, 70);
      doc.text(card.label, x + cardW / 2, y + 6, { align: "center" });
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...card.color);
      doc.text(card.value, x + cardW / 2, y + 14, { align: "center" });
    });
    y += 24;

    // Ventas por método de pago
    doc.autoTable({
      startY: y,
      head: [["Método de Pago", "Transacciones", "Total Recaudado"]],
      body: [
        ...(data.sales_by_method || []).map((s) => [
          s.payment_method === "efectivo" ? "💵 Efectivo" : "📱 SINPE",
          s.count.toString(),
          fmt(s.total),
        ]),
        ["TOTAL", data.total_count.toString(), fmt(data.total_sales)],
      ],
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [45, 21, 7], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 247, 242] },
      didParseCell: (d) => {
        if (d.row.index === (data.sales_by_method?.length || 0)) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [200, 87, 10];
          d.cell.styles.textColor = 255;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── SECCIÓN 2: TESORERÍA ─────────────────────────────────
    checkSpace(40);
    doc.setFillColor(245, 240, 232);
    doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(45, 122, 79);
    doc.text("SALDO DE TESORERÍA", 18, y + 5.5);
    doc.setTextColor(26, 18, 8);
    y += 11;

    doc.autoTable({
      startY: y,
      head: [["Cuenta", "Saldo Actual"]],
      body: (data.treasury || []).map((t) => [
        t.type === "caja" ? "💵 Caja Física" : "📱 Cuenta SINPE",
        fmt(t.balance),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: {
        fillColor: [45, 122, 79],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [212, 237, 223] },
      columnStyles: { 1: { fontStyle: "bold", halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── SECCIÓN 3: DETALLE DE VENTAS ─────────────────────────
    if ((data.sales_detail || []).length > 0) {
      checkSpace(20);
      doc.setFillColor(245, 240, 232);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 95, 168);
      doc.text(`DETALLE DE VENTAS (${data.sales_detail.length})`, 18, y + 5.5);
      doc.setTextColor(26, 18, 8);
      y += 13;

      data.sales_detail.forEach((sale, idx) => {
        checkSpace(30);

        // Header de la venta
        doc.setFillColor(219, 234, 254);
        doc.roundedRect(14, y, W - 28, 8, 1, 1, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 95, 168);
        doc.text(`Venta #${String(idx + 1).padStart(3, "0")}`, 17, y + 5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`${sale.hora}`, 60, y + 5.5);
        doc.text(
          `${sale.payment_method === "efectivo" ? "💵 Efectivo" : "📱 SINPE"}`,
          85,
          y + 5.5,
        );
        if (sale.sinpe_description)
          doc.text(`Ref: ${sale.sinpe_description}`, 115, y + 5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 87, 10);
        doc.text(fmt(sale.total), W - 14, y + 5.5, { align: "right" });
        y += 10;

        // Productos de la venta
        const items = (sale.items || []).filter(Boolean);
        doc.autoTable({
          startY: y,
          body: items.map((item) => [
            item.product_name,
            item.quantity.toString(),
            fmt(item.unit_price),
            fmt(item.subtotal),
          ]),
          margin: { left: 20, right: 14 },
          styles: { fontSize: 8.5, cellPadding: 2.5 },
          columnStyles: {
            0: { cellWidth: "auto" },
            1: { halign: "center", cellWidth: 20 },
            2: { halign: "right", cellWidth: 30 },
            3: { halign: "right", cellWidth: 30, fontStyle: "bold" },
          },
          alternateRowStyles: { fillColor: [248, 245, 240] },
          theme: "plain",
        });
        y = doc.lastAutoTable.finalY + 6;
      });

      y += 4;
    }

    // ── SECCIÓN 4: MOVIMIENTOS DE INVENTARIO ──────────────────
    if ((data.movements || []).length > 0) {
      checkSpace(20);
      doc.setFillColor(245, 240, 232);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 50, 150);
      doc.text(
        `MOVIMIENTOS DE INVENTARIO (${data.movements.length})`,
        18,
        y + 5.5,
      );
      doc.setTextColor(26, 18, 8);
      y += 11;

      doc.autoTable({
        startY: y,
        head: [["Producto", "SKU", "Tipo", "Cantidad", "Motivo"]],
        body: data.movements.map((m) => [
          m.product_name,
          m.sku,
          MOVEMENT_LABELS[m.type] || m.type,
          m.type === "entrada" ? `+${m.quantity}` : `-${m.quantity}`,
          m.reason || "—",
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: {
          fillColor: [100, 50, 150],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [240, 230, 255] },
        columnStyles: { 3: { halign: "center", fontStyle: "bold" } },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ── SECCIÓN 5: BAJO STOCK ─────────────────────────────────
    if ((data.low_stock || []).length > 0) {
      checkSpace(20);
      doc.setFillColor(253, 232, 230);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(192, 57, 43);
      doc.text(
        `⚠ ALERTA: ${data.low_stock.length} PRODUCTOS CON BAJO STOCK`,
        18,
        y + 5.5,
      );
      doc.setTextColor(26, 18, 8);
      y += 11;

      doc.autoTable({
        startY: y,
        head: [["Producto", "SKU", "Categoría", "Stock Actual", "Mínimo"]],
        body: data.low_stock.map((p) => [
          p.name,
          p.sku,
          p.category_name || "—",
          p.stock.toString(),
          p.min_stock.toString(),
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: {
          fillColor: [192, 57, 43],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [253, 232, 230] },
        columnStyles: {
          3: { halign: "center", textColor: [192, 57, 43], fontStyle: "bold" },
          4: { halign: "center" },
        },
      });
    }

    // ── FOOTER ───────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(45, 21, 7);
      doc.rect(0, 285, W, 12, "F");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`Pulpería JTN · Cierre de Caja ${fmtDate(data.date)}`, 14, 292);
      doc.text(`Página ${i} de ${totalPages}`, W - 14, 292, { align: "right" });
    }

    return doc;
  };

  const downloadPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    doc.save(`cierre-caja-${data.date}.pdf`);
    toast.success("PDF descargado");
  };

  const sendEmailFn = async () => {
    if (!email.trim()) return toast.error("Ingresa un email destinatario");
    const doc = generatePDF();
    if (!doc) return;
    setSending(true);
    try {
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const { data: res } = await reportsAPI.sendEmail({
        to: email.trim(),
        date: data.date,
        pdfBase64,
        filename: `cierre-caja-${data.date}.pdf`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <div style="background:#2d1507;color:white;padding:24px;border-radius:12px 12px 0 0;border-bottom:4px solid #c8570a">
              <h2 style="margin:0;font-size:22px">🏪 Pulpería JTN</h2>
              <p style="margin:6px 0 0;opacity:0.8;font-size:14px">Cierre de Caja — ${fmtDate(data.date)}</p>
            </div>
            <div style="background:#faf7f2;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e8dfd0">
              <p style="color:#1a1208;font-size:14px">Adjunto el informe de cierre de caja del día <strong>${fmtDate(data.date)}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:10px 14px;background:#f5f0e8;font-weight:600;font-size:13px;color:#6b5c42">Total Ventas</td>
                    <td style="padding:10px 14px;background:#f5f0e8;font-weight:800;font-size:16px;color:#c8570a;text-align:right">${fmt(data.total_sales)}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;color:#6b5c42">Transacciones</td>
                    <td style="padding:10px 14px;font-weight:600;text-align:right">${data.total_count}</td></tr>
                ${(data.treasury || [])
                  .map(
                    (t) => `
                <tr><td style="padding:10px 14px;background:#f5f0e8;font-size:13px;color:#6b5c42">${t.type === "caja" ? "💵 Saldo Caja" : "📱 Saldo SINPE"}</td>
                    <td style="padding:10px 14px;background:#f5f0e8;font-weight:700;text-align:right">${fmt(t.balance)}</td></tr>`,
                  )
                  .join("")}
                <tr><td style="padding:10px 14px;font-size:13px;color:#6b5c42">Alertas de Stock</td>
                    <td style="padding:10px 14px;font-weight:600;text-align:right;color:${data.low_stock?.length > 0 ? "#c0392b" : "#2d7a4f"}">
                      ${data.low_stock?.length > 0 ? `⚠️ ${data.low_stock.length} productos` : "✅ Todo OK"}</td></tr>
              </table>
              <p style="color:#a8937a;font-size:12px;margin-top:20px;border-top:1px solid #e8dfd0;padding-top:12px">
                Generado por: <strong>${data.generated_by}</strong> · ${fmtDateTime(data.generated_at)}
              </p>
            </div>
          </div>`,
      });
      toast.success(res.message);
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al enviar email");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={openModal}>
        📋 Cierre de Caja
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="📋 Cierre de Caja Diario"
        maxWidth={680}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 18,
          }}
        >
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Fecha del informe</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button
            className="btn btn-accent"
            onClick={() => load(date)}
            disabled={loading}
          >
            {loading ? "Cargando…" : "🔄 Cargar"}
          </button>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--text3)",
            }}
          >
            Cargando datos…
          </div>
        )}

        {data && !loading && (
          <>
            {/* Resumen cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: "var(--accent-light)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    marginBottom: 2,
                  }}
                >
                  VENTAS DEL DÍA
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 20,
                    color: "var(--accent)",
                  }}
                >
                  {fmt(data.total_sales)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>
                  {data.total_count} transacciones
                </div>
              </div>
              {(data.treasury || []).map((t) => (
                <div
                  key={t.type}
                  style={{
                    background: "var(--green-light)",
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--green)",
                      marginBottom: 2,
                    }}
                  >
                    {t.type === "caja" ? "💵 CAJA" : "📱 SINPE"}
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 20,
                      color: "var(--green)",
                    }}
                  >
                    {fmt(t.balance)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    Saldo actual
                  </div>
                </div>
              ))}
            </div>

            {/* Alerta bajo stock */}
            {data.low_stock?.length > 0 && (
              <div
                style={{
                  background: "var(--red-light)",
                  border: "1px solid #f5c6c3",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                ⚠️ <strong>{data.low_stock.length} productos</strong> con stock
                bajo:{" "}
                {data.low_stock
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(", ")}
                {data.low_stock.length > 3 ? "…" : ""}
              </div>
            )}

            {/* Preview ventas */}
            {data.sales_detail?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  Ventas del día ({data.sales_detail.length})
                </div>
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                >
                  {data.sales_detail.map((sale, i) => (
                    <div
                      key={sale.id}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border)",
                        background: i % 2 === 0 ? "white" : "var(--surface2)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>
                            #{String(i + 1).padStart(3, "0")}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>
                            {sale.hora}
                          </span>
                          <span
                            className={`badge ${sale.payment_method === "efectivo" ? "badge-green" : "badge-blue"}`}
                            style={{ fontSize: 10 }}
                          >
                            {sale.payment_method === "efectivo" ? "💵" : "📱"}{" "}
                            {sale.payment_method}
                          </span>
                        </div>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "var(--accent)",
                          }}
                        >
                          {fmt(sale.total)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text3)",
                          marginTop: 3,
                        }}
                      >
                        {(sale.items || [])
                          .filter(Boolean)
                          .map(
                            (item) => `${item.product_name} ×${item.quantity}`,
                          )
                          .join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email */}
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                📧 Enviar por Email
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "9px 13px",
                    border: "1.5px solid var(--border)",
                    borderRadius: 8,
                    fontFamily: "Sora,sans-serif",
                    fontSize: 13,
                    outline: "none",
                    background: "white",
                  }}
                />
                <button
                  className="btn btn-blue"
                  onClick={sendEmailFn}
                  disabled={sending}
                >
                  {sending ? "Enviando…" : "📤 Enviar"}
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cerrar
              </button>
              <button className="btn btn-accent" onClick={downloadPDF}>
                ⬇️ Descargar PDF
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
