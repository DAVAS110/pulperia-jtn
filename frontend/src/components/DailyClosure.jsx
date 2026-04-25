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
    let y = 18;

    // Header
    doc.setFillColor(200, 87, 10);
    doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Pulperia JTN", 14, 13);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Cierre de Caja — ${fmtDate(data.date)}`, 14, 21);
    doc.setFontSize(9);
    doc.text(
      `Generado: ${fmtDateTime(data.generated_at)} · Por: ${data.generated_by}`,
      W - 14,
      21,
      { align: "right" },
    );

    y = 38;
    doc.setTextColor(26, 18, 8);

    // Ventas del día
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Ventas del Día", 14, y);
    y += 6;

    const salesRows = (data.sales_by_method || []).map((s) => [
      s.payment_method === "efectivo" ? "Efectivo" : "SINPE",
      s.count.toString(),
      fmt(s.total),
    ]);
    if (!salesRows.length) salesRows.push(["Sin ventas", "—", "—"]);
    salesRows.push([
      "TOTAL",
      data.total_count.toString(),
      fmt(data.total_sales),
    ]);

    doc.autoTable({
      startY: y,
      head: [["Método", "Transacciones", "Total"]],
      body: salesRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [200, 87, 10],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 247, 242] },
      didParseCell: (d) => {
        if (d.row.index === salesRows.length - 1) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [245, 240, 232];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Saldo de Tesorería
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Saldo Actual de Tesorería", 14, y);
    y += 6;

    doc.autoTable({
      startY: y,
      head: [["Cuenta", "Saldo Actual"]],
      body: (data.treasury || []).map((t) => [
        t.type === "caja" ? "Caja Física" : "Cuenta SINPE",
        fmt(t.balance),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [45, 122, 79],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [212, 237, 223] },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Movimientos de inventario
    if ((data.movements || []).length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Movimientos de Inventario", 14, y);
      y += 6;

      doc.autoTable({
        startY: y,
        head: [["Producto", "SKU", "Tipo", "Cantidad", "Motivo", "Usuario"]],
        body: data.movements.map((m) => [
          m.product_name,
          m.sku,
          MOVEMENT_LABELS[m.type] || m.type,
          m.type === "entrada" ? `+${m.quantity}` : `-${m.quantity}`,
          m.reason || "—",
          m.user_name || "—",
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: {
          fillColor: [26, 95, 168],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [219, 234, 254] },
        columnStyles: { 3: { halign: "center" } },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Productos con bajo stock
    if ((data.low_stock || []).length > 0) {
      if (y > 220) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(192, 57, 43);
      doc.text(
        `Alerta: ${data.low_stock.length} Productos con Bajo Stock`,
        14,
        y,
      );
      doc.setTextColor(26, 18, 8);
      y += 6;

      doc.autoTable({
        startY: y,
        head: [
          ["Producto", "SKU", "Categoría", "Stock Actual", "Stock Mínimo"],
        ],
        body: data.low_stock.map((p) => [
          p.name,
          p.sku,
          p.category_name || "—",
          p.stock.toString(),
          p.min_stock.toString(),
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2 },
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

    // Footer en todas las páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(168, 147, 122);
      doc.text(`Pulperia JTN · Página ${i} de ${totalPages}`, W / 2, 290, {
        align: "center",
      });
    }

    return doc;
  };

  const downloadPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    doc.save(`cierre-caja-${data.date}.pdf`);
    toast.success("PDF descargado");
  };

  const sendEmail = async () => {
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
            <div style="background:#c8570a;color:white;padding:24px;border-radius:12px 12px 0 0">
              <h2 style="margin:0;font-size:22px">🏪 Pulperia JTN</h2>
              <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Cierre de Caja — ${fmtDate(data.date)}</p>
            </div>
            <div style="background:#faf7f2;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e8dfd0">
              <p style="color:#1a1208;font-size:14px">Hola,</p>
              <p style="color:#1a1208;font-size:14px">Adjunto el informe de cierre de caja del día <strong>${fmtDate(data.date)}</strong>.</p>

              <table style="width:100%;border-collapse:collapse;margin:18px 0;border-radius:8px;overflow:hidden">
                <tr>
                  <td style="padding:10px 14px;background:#f5f0e8;font-weight:600;font-size:13px;color:#6b5c42">Total Ventas</td>
                  <td style="padding:10px 14px;background:#f5f0e8;font-weight:800;font-size:16px;color:#c8570a;text-align:right">${fmt(data.total_sales)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#6b5c42">Transacciones</td>
                  <td style="padding:10px 14px;font-weight:600;text-align:right">${data.total_count}</td>
                </tr>
                ${(data.treasury || [])
                  .map(
                    (t) => `
                <tr>
                  <td style="padding:10px 14px;background:#f5f0e8;font-size:13px;color:#6b5c42">${t.type === "caja" ? "💵 Saldo Caja" : "📱 Saldo SINPE"}</td>
                  <td style="padding:10px 14px;background:#f5f0e8;font-weight:700;text-align:right">${fmt(t.balance)}</td>
                </tr>`,
                  )
                  .join("")}
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#6b5c42">Alertas de Stock</td>
                  <td style="padding:10px 14px;font-weight:600;text-align:right;color:${data.low_stock?.length > 0 ? "#c0392b" : "#2d7a4f"}">
                    ${data.low_stock?.length > 0 ? `⚠️ ${data.low_stock.length} productos` : "✅ Todo OK"}
                  </td>
                </tr>
              </table>

              <p style="color:#a8937a;font-size:12px;margin-top:20px;border-top:1px solid #e8dfd0;padding-top:12px">
                Generado por: <strong>${data.generated_by}</strong> · ${fmtDateTime(data.generated_at)}<br/>
                Pulperia JTN — Sistema de Gestión de Inventario
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
        {/* Selector de fecha */}
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
            Cargando datos del día…
          </div>
        )}

        {data && !loading && (
          <>
            {/* Cards resumen */}
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

            {/* Preview movimientos */}
            {data.movements?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  Movimientos del día ({data.movements.length})
                </div>
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                >
                  {data.movements.slice(0, 10).map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 12.5,
                        background: i % 2 === 0 ? "white" : "var(--surface2)",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          minWidth: 130,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.product_name}
                      </span>
                      <span
                        style={{
                          color:
                            m.type === "entrada"
                              ? "var(--green)"
                              : "var(--red)",
                          fontWeight: 700,
                          minWidth: 40,
                        }}
                      >
                        {m.type === "entrada" ? "+" : "-"}
                        {m.quantity}
                      </span>
                      <span style={{ color: "var(--text3)", flex: 1 }}>
                        {m.reason || "—"}
                      </span>
                    </div>
                  ))}
                  {data.movements.length > 10 && (
                    <div
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        color: "var(--text3)",
                        textAlign: "center",
                      }}
                    >
                      +{data.movements.length - 10} más en el PDF completo
                    </div>
                  )}
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
                  placeholder="destinatario@gmail.com"
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
                  onClick={sendEmail}
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
