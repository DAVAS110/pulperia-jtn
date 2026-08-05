import React, { useState } from "react";
import { reportsAPI } from "../services/api";
import { Modal, StatCard } from "./ui";
import { toast } from "../store/toastStore";
import { fmt, fmtDate, fmtDateTime } from "../utils/helpers";
import {
  FiDollarSign,
  FiSmartphone,
  FiMail,
  FiAlertTriangle,
  FiRepeat,
} from "react-icons/fi";

// jsPDF solo lo necesita este modal (admin) — se carga bajo demanda
// en vez de bloquear la carga inicial de toda la app para todos los usuarios.
let pdfLibsPromise = null;
const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
const loadPdfLibs = () => {
  if (window.jspdf) return Promise.resolve();
  if (!pdfLibsPromise) {
    pdfLibsPromise = loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    ).then(() =>
      loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
      ),
    );
  }
  return pdfLibsPromise;
};

const MOVEMENT_LABELS = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  pérdida: "Perdida",
  venta: "Venta",
  anulacion: "Anulacion",
};

const localDateStr = (d = new Date()) => {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

// Resta días en hora local (evita el corrimiento de toISOString(), que usa UTC)
const daysAgoLocal = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

export default function DailyClosure() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localDateStr);
  const [dateTo, setDateTo] = useState(localDateStr);
  const [email, setEmail] = useState("vargasariasdavid110@gmail.com");
  const [sending, setSending] = useState(false);

  // ── Helpers ──────────────────────────────────────────────
  const safeDateStr = (str) => {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x00-\x7F]/g, "?");
  };

  const pdfFmt = (n) =>
    "CRC " +
    Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  // ── Load data ────────────────────────────────────────────
  const load = async (from, to) => {
    if (!from || !to) return toast.error("Selecciona ambas fechas");
    if (from > to)
      return toast.error(
        "La fecha de inicio no puede ser mayor a la fecha fin",
      );

    setLoading(true);
    setData(null);
    try {
      const { data: res } = await reportsAPI.daily({
        date_from: from,
        date_to: to,
      });
      console.log("[DailyClosure] Rango:", from, "->", to);
      console.log(
        "[DailyClosure] sales_detail:",
        res?.sales_detail?.length,
        res?.sales_detail,
      );
      setData(res);
    } catch (err) {
      console.error("[DailyClosure] Error:", err);
      toast.error(err.response?.data?.error || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setOpen(true);
    setData(null);
  };

  const getTreasuryBalance = (type) =>
    parseFloat(data?.treasury?.find((t) => t.type === type)?.balance ?? 0);

  const getSalesByMethod = (method) =>
    parseFloat(
      data?.sales_by_method?.find((s) => s.payment_method === method)?.total ?? 0,
    );

  const totalCashSales = getSalesByMethod("efectivo");
  const totalSinpeSales = getSalesByMethod("sinpe");
  const totalCash = getTreasuryBalance("caja");
  const totalSinpe = getTreasuryBalance("sinpe");
  const totalInventoryMovements = data?.movements?.length ?? 0;
  const lowStockCount = data?.low_stock?.length ?? 0;

  // ── PDF generation ────────────────────────────────────────
  const generatePDF = () => {
    if (!data || !window.jspdf) {
      toast.error("jsPDF no esta cargado.");
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

    const isRange = dateFrom !== dateTo;
    const safeFrom = safeDateStr(fmtDate(dateFrom));
    const safeTo = safeDateStr(fmtDate(dateTo));
    const periodLabel = isRange ? `${safeFrom} al ${safeTo}` : safeFrom;
    const safeGeneratedAt = safeDateStr(fmtDateTime(data.generated_at));
    const safeGeneratedBy = safeDateStr(data.generated_by || "");

    // Paleta consistente con la app (celeste/azul), un solo acento —
    // el color se reserva para lo que necesita atención (alertas de stock).
    const ACCENT = [14, 165, 233]; // --accent
    const ACCENT2 = [2, 132, 199]; // --accent2
    const ACCENT_LIGHT = [230, 248, 255]; // --accent-light
    const TEXT = [7, 34, 39]; // --text
    const TEXT3 = [107, 152, 166]; // --text3
    const RED = [192, 57, 43]; // --red
    const RED_LIGHT = [253, 232, 230]; // --red-light
    const GREEN = [45, 122, 79]; // --green

    const sectionHeader = (label) => {
      checkSpace(18);
      doc.setFillColor(...ACCENT_LIGHT);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...ACCENT2);
      doc.text(label, 18, y + 5.5);
      doc.setTextColor(...TEXT);
      y += 12;
    };

    // ── HEADER ───────────────────────────────────────────────
    doc.setFillColor(...ACCENT2);
    doc.rect(0, 0, W, 32, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(0, 28, W, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Pulperia JTN", 14, 13);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      isRange
        ? `Reporte de Ventas - ${periodLabel}`
        : `Cierre de Caja - ${periodLabel}`,
      14,
      22,
    );
    doc.setFontSize(8);
    doc.setTextColor(220, 240, 250);
    doc.text(
      `Generado: ${safeGeneratedAt} | Por: ${safeGeneratedBy}`,
      W - 14,
      22,
      { align: "right" },
    );

    y = 42;
    doc.setTextColor(...TEXT);

    // ── RESUMEN ────────────────────────────────────────────────
    const lowStockCount = data.low_stock?.length || 0;
    const cardW = (W - 28 - 8) / 3;
    const cards = [
      { label: "Total Ventas", value: pdfFmt(data.total_sales), color: ACCENT2 },
      { label: "Transacciones", value: String(data.total_count), color: TEXT },
      {
        label: "Alertas Stock",
        value: lowStockCount > 0 ? `${lowStockCount}` : "OK",
        color: lowStockCount > 0 ? RED : GREEN,
      },
    ];

    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(225, 235, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, cardW, 18, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT3);
      doc.text(card.label, x + cardW / 2, y + 6, { align: "center" });
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...card.color);
      doc.text(card.value, x + cardW / 2, y + 14, { align: "center" });
    });
    y += 24;

    // Ventas por metodo de pago
    doc.autoTable({
      startY: y,
      head: [["Metodo de Pago", "Transacciones", "Total Recaudado"]],
      body: [
        ...(data.sales_by_method || []).map((s) => [
          s.payment_method === "efectivo" ? "Efectivo" : "SINPE",
          s.count.toString(),
          pdfFmt(s.total),
        ]),
        ["TOTAL", String(data.total_count), pdfFmt(data.total_sales)],
      ],
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 4, textColor: TEXT },
      headStyles: { fillColor: ACCENT2, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 251, 255] },
      didParseCell: (d) => {
        if (d.row.index === (data.sales_by_method?.length || 0)) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = ACCENT_LIGHT;
          d.cell.styles.textColor = ACCENT2;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── TESORERIA ──────────────────────────────────────────────
    sectionHeader("SALDO DE TESORERIA");
    doc.autoTable({
      startY: y,
      head: [["Cuenta", "Saldo Actual"]],
      body: (data.treasury || []).map((t) => [
        t.type === "caja" ? "Caja Fisica" : "Cuenta SINPE",
        pdfFmt(t.balance),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10, cellPadding: 4, textColor: TEXT },
      headStyles: { fillColor: ACCENT2, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 251, 255] },
      columnStyles: { 1: { fontStyle: "bold", halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── VENTAS DEL PERIODO ─────────────────────────────────────
    // Una fila por venta (sin desglose de artículos) para un reporte conciso.
    if ((data.sales_detail || []).length > 0) {
      sectionHeader(`VENTAS (${data.sales_detail.length})`);
      doc.autoTable({
        startY: y,
        head: [["#", "Fecha", "Hora", "Metodo", "Articulos", "Total"]],
        body: data.sales_detail.map((sale, idx) => [
          String(idx + 1).padStart(3, "0"),
          sale.fecha ? safeDateStr(fmtDate(sale.fecha)) : "-",
          safeDateStr(sale.hora || "-"),
          sale.payment_method === "efectivo" ? "Efectivo" : "SINPE",
          (sale.items || []).filter(Boolean).length.toString(),
          pdfFmt(sale.total),
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 3, textColor: TEXT },
        headStyles: { fillColor: ACCENT2, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 251, 255] },
        columnStyles: {
          4: { halign: "center" },
          5: { halign: "right", fontStyle: "bold" },
        },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ── MOVIMIENTOS DE INVENTARIO ──────────────────────────────
    if ((data.movements || []).length > 0) {
      sectionHeader(`MOVIMIENTOS DE INVENTARIO (${data.movements.length})`);
      doc.autoTable({
        startY: y,
        head: [["Producto", "SKU", "Tipo", "Cantidad", "Motivo"]],
        body: data.movements.map((m) => [
          safeDateStr(m.product_name),
          m.sku,
          MOVEMENT_LABELS[m.type] || m.type,
          m.type === "entrada" ? `+${m.quantity}` : `-${m.quantity}`,
          safeDateStr(m.reason || "-"),
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2.5, textColor: TEXT },
        headStyles: { fillColor: ACCENT2, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 251, 255] },
        columnStyles: { 3: { halign: "center", fontStyle: "bold" } },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ── BAJO STOCK ─────────────────────────────────────────────
    if ((data.low_stock || []).length > 0) {
      checkSpace(18);
      doc.setFillColor(...RED_LIGHT);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...RED);
      doc.text(
        `ALERTA: ${data.low_stock.length} PRODUCTOS CON BAJO STOCK`,
        18,
        y + 5.5,
      );
      doc.setTextColor(...TEXT);
      y += 12;

      doc.autoTable({
        startY: y,
        head: [["Producto", "SKU", "Categoria", "Stock Actual", "Minimo"]],
        body: data.low_stock.map((p) => [
          safeDateStr(p.name),
          p.sku,
          safeDateStr(p.category_name || "-"),
          p.stock.toString(),
          p.min_stock.toString(),
        ]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2.5, textColor: TEXT },
        headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: RED_LIGHT },
        columnStyles: {
          3: { halign: "center", textColor: RED, fontStyle: "bold" },
          4: { halign: "center" },
        },
      });
    }

    // ── FOOTER ────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(2, 40, 51); // --sidebar-gradient-start
      doc.rect(0, 285, W, 12, "F");
      doc.setFontSize(8);
      doc.setTextColor(210, 230, 235);
      doc.text(`Pulperia JTN - ${periodLabel}`, 14, 292);
      doc.text(`Pagina ${i} de ${totalPages}`, W - 14, 292, { align: "right" });
    }

    return doc;
  };

  const downloadPDF = async () => {
    try {
      await loadPdfLibs();
    } catch {
      return toast.error("No se pudo cargar el generador de PDF");
    }
    const doc = generatePDF();
    if (!doc) return;
    const suffix = dateFrom === dateTo ? dateFrom : `${dateFrom}_${dateTo}`;
    doc.save(`cierre-caja-${suffix}.pdf`);
    toast.success("PDF descargado");
  };

  const sendEmailFn = async () => {
    if (!email.trim()) return toast.error("Ingresa un email destinatario");
    setSending(true);
    try {
      await loadPdfLibs();
    } catch {
      setSending(false);
      return toast.error("No se pudo cargar el generador de PDF");
    }
    const doc = generatePDF();
    if (!doc) {
      setSending(false);
      return;
    }
    const isRange = dateFrom !== dateTo;
    const periodLabel = isRange
      ? `${fmtDate(dateFrom)} al ${fmtDate(dateTo)}`
      : fmtDate(dateFrom);
    try {
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const suffix = dateFrom === dateTo ? dateFrom : `${dateFrom}_${dateTo}`;
      const { data: res } = await reportsAPI.sendEmail({
        to: email.trim(),
        date: dateFrom,
        date_to: dateTo,
        pdfBase64,
        filename: `cierre-caja-${suffix}.pdf`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <div style="background:#0284c7;color:white;padding:24px;border-radius:12px 12px 0 0;border-bottom:4px solid #0ea5e9">
              <h2 style="margin:0;font-size:22px">Pulperia JTN</h2>
              <p style="margin:6px 0 0;opacity:0.8;font-size:14px">${isRange ? "Reporte de Ventas" : "Cierre de Caja"} &mdash; ${periodLabel}</p>
            </div>
            <div style="background:#e6f8ff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #7dd3fc">
              <p style="color:#0c4a6e;font-size:14px">Adjunto el informe del periodo <strong>${periodLabel}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:10px 14px;background:#cef4ff;font-weight:600;font-size:13px;color:#0c4a6e">Total Ventas</td>
                    <td style="padding:10px 14px;background:#cef4ff;font-weight:800;font-size:16px;color:#0ea5e9;text-align:right">${fmt(data.total_sales)}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;color:#0c4a6e">Transacciones</td>
                    <td style="padding:10px 14px;font-weight:600;text-align:right">${data.total_count}</td></tr>
                ${(data.treasury || [])
                  .map(
                    (t) => `
                <tr><td style="padding:10px 14px;background:#cef4ff;font-size:13px;color:#0c4a6e">${t.type === "caja" ? "Saldo Caja" : "Saldo SINPE"}</td>
                    <td style="padding:10px 14px;background:#cef4ff;font-weight:700;text-align:right">${fmt(t.balance)}</td></tr>`,
                  )
                  .join("")}
                <tr><td style="padding:10px 14px;font-size:13px;color:#0c4a6e">Alertas de Stock</td>
                    <td style="padding:10px 14px;font-weight:600;text-align:right;color:${data.low_stock?.length > 0 ? "#c0392b" : "#2d7a4f"}">
                      ${data.low_stock?.length > 0 ? `${data.low_stock.length} productos con bajo stock` : "Todo OK"}</td></tr>
              </table>
              <p style="color:#0284c7;font-size:12px;margin-top:20px;border-top:1px solid #7dd3fc;padding-top:12px">
                Generado por: <strong>${data.generated_by}</strong> &middot; ${fmtDateTime(data.generated_at)}
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

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={openModal}>
        Cierre de Caja
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cierre de Caja / Reporte de Ventas"
        maxWidth={720}
      >
        {/* ── Selector de rango ── */}
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 10,
              color: "var(--text2)",
            }}
          >
            Rango de fechas
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              className="field"
              style={{ flex: 1, minWidth: 140, marginBottom: 0 }}
            >
              <label style={{ fontSize: 12 }}>Desde</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div
              className="field"
              style={{ flex: 1, minWidth: 140, marginBottom: 0 }}
            >
              <label style={{ fontSize: 12 }}>Hasta</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              className="btn btn-accent"
              onClick={() => load(dateFrom, dateTo)}
              disabled={loading}
              style={{ whiteSpace: "nowrap" }}
            >
              {loading ? "Cargando..." : "Cargar"}
            </button>
          </div>

          {/* Shortcuts */}
          <div
            style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}
          >
            {[
              {
                label: "Hoy",
                range: () => [localDateStr(), localDateStr()],
              },
              {
                label: "Ayer",
                range: () => [daysAgoLocal(1), daysAgoLocal(1)],
              },
              {
                label: "Últimos 7 días",
                range: () => [daysAgoLocal(6), localDateStr()],
              },
              {
                label: "Este mes",
                range: () => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  return [localDateStr(first), localDateStr()];
                },
              },
            ].map(({ label, range }) => (
              <button
                key={label}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: "4px 10px" }}
                onClick={() => {
                  const [from, to] = range();
                  setDateFrom(from);
                  setDateTo(to);
                  load(from, to);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--text3)",
            }}
          >
            Cargando datos...
          </div>
        )}

        {!loading && !data && (
          <div
            style={{
              textAlign: "center",
              padding: "30px 0",
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            Selecciona un rango y presiona Cargar
          </div>
        )}

        {data && !loading && (
          <>
            {/* Resumen */}
            <div
              className="stats-grid stats-grid-3"
              style={{ marginBottom: 14 }}
            >
              <StatCard
                icon={<FiDollarSign />}
                label={dateFrom !== dateTo ? "Ventas del período" : "Ventas del día"}
                value={fmt(data.total_sales)}
                sub={`${data.total_count} transacciones`}
                iconBg="#e6f8ff"
              />
              <StatCard
                icon={<FiDollarSign />}
                label="Caja"
                value={fmt(totalCash)}
                sub="Saldo actual"
                iconBg="#d4eddf"
              />
              <StatCard
                icon={<FiSmartphone />}
                label="SINPE"
                value={fmt(totalSinpe)}
                sub="Saldo actual"
                iconBg="#dbeafe"
              />
              <StatCard
                icon={<FiDollarSign />}
                label="Ventas efectivo"
                value={fmt(totalCashSales)}
                sub={`${data.sales_by_method?.find((s) => s.payment_method === "efectivo")?.count ?? 0} ventas`}
                iconBg="#f4f6f8"
              />
              <StatCard
                icon={<FiSmartphone />}
                label="Ventas SINPE"
                value={fmt(totalSinpeSales)}
                sub={`${data.sales_by_method?.find((s) => s.payment_method === "sinpe")?.count ?? 0} ventas`}
                iconBg="#f4f6f8"
              />
              <StatCard
                icon={<FiRepeat />}
                label="Movimientos inventario"
                value={totalInventoryMovements}
                sub="Registrados en el período"
                iconBg="#f4f6f8"
              />
            </div>

            {/* Alerta bajo stock */}
            {data.low_stock?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--red-light)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  fontSize: 13,
                  color: "var(--text2)",
                }}
              >
                <FiAlertTriangle style={{ color: "var(--red)", flexShrink: 0 }} />
                <span>
                  <strong>{data.low_stock.length} productos</strong> con stock
                  bajo:{" "}
                  {data.low_stock
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", ")}
                  {data.low_stock.length > 3 ? "…" : ""}
                </span>
              </div>
            )}

            {/* Preview ventas */}
            {data.sales_detail?.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  Ventas ({data.sales_detail.length})
                </div>
                <div
                  style={{
                    maxHeight: 320,
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
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>
                            #{String(i + 1).padStart(3, "0")}
                          </span>
                          {sale.fecha && (
                            <span
                              style={{ fontSize: 12, color: "var(--text3)" }}
                            >
                              {fmtDate(sale.fecha)}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>
                            {sale.hora}
                          </span>
                          <span
                            className={`badge ${sale.payment_method === "efectivo" ? "badge-green" : "badge-blue"}`}
                            style={{ fontSize: 10 }}
                          >
                            {sale.payment_method === "efectivo" ? (
                              <FiDollarSign />
                            ) : (
                              <FiSmartphone />
                            )}{" "}
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
                            (item) => `${item.product_name} x${item.quantity}`,
                          )
                          .join(" | ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px 0",
                  color: "var(--text3)",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                No hay ventas en este periodo
              </div>
            )}

            {/* Email */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
                marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>
                <FiMail /> Enviar por email
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <button
                  className="btn btn-accent"
                  onClick={sendEmailFn}
                  disabled={sending}
                >
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cerrar
              </button>
              <button className="btn btn-accent" onClick={downloadPDF}>
                Descargar PDF
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
