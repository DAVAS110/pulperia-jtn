import React, { useState, useEffect, useCallback } from "react";
import { salesAPI } from "../services/api";
import { Modal, Spinner, EmptyState, Pagination } from "../components/ui";
import { toast } from "../store/toastStore";
import { fmt, fmtDateTime } from "../utils/helpers";
import useAuthStore from "../store/authStore";

export default function Ventas() {
  const { isAdmin } = useAuthStore();
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await salesAPI.list({
        page,
        limit: 30,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSales(data.sales);
      setTotal(data.total);
    } catch {
      toast.error("Error al cargar ventas");
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id) => {
    try {
      await salesAPI.cancel(id);
      toast.success("Venta anulada");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al anular");
    }
    setConfirm(null);
  };

  const totalFiltered = sales.reduce(
    (s, sale) => s + parseFloat(sale.total),
    0,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Historial de Ventas</h1>
          <p>{total} ventas registradas</p>
        </div>
      </div>

      <div className="filters-bar">
        <label
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}
        >
          Desde:
        </label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "8px 12px",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            fontFamily: "Sora,sans-serif",
            fontSize: 13,
            outline: "none",
          }}
        />
        <label
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}
        >
          Hasta:
        </label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "8px 12px",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            fontFamily: "Sora,sans-serif",
            fontSize: 13,
            outline: "none",
          }}
        />
        {(dateFrom || dateTo) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            ✕ Limpiar
          </button>
        )}
        {sales.length > 0 && (
          <div style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15 }}>
            Total:{" "}
            <span style={{ color: "var(--accent)" }}>{fmt(totalFiltered)}</span>
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : sales.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No hay ventas"
            description="Las ventas aparecerán aquí una vez que uses la Caja"
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Artículos</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--text3)", fontSize: 12 }}>
                      {String(idx + 1 + (page - 1) * 30).padStart(4, "0")}
                    </td>
                    <td
                      style={{
                        fontSize: 12.5,
                        color: "var(--text2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDateTime(s.created_at)}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {(s.items || []).filter(Boolean).length} artículo(s)
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 15 }}>
                      {fmt(s.total)}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          className={`badge ${s.payment_method === "efectivo" ? "badge-green" : "badge-blue"}`}
                        >
                          {s.payment_method === "efectivo" ? "💵" : "📱"}{" "}
                          {s.payment_method}
                        </span>
                        {s.sinpe_photo && (
                          <span
                            title="Tiene foto de comprobante"
                            style={{ fontSize: 14 }}
                          >
                            📷
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text3)" }}>
                      {s.user_name || "—"}
                    </td>
                    <td>
                      <span
                        className={`badge ${s.status === "completada" ? "badge-green" : "badge-red"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          className="btn-icon"
                          onClick={() => setDetail(s)}
                          title="Ver detalle"
                        >
                          👁️
                        </button>
                        {isAdmin() && s.status === "completada" && (
                          <button
                            className="btn-icon"
                            onClick={() => setConfirm(s.id)}
                            title="Anular"
                          >
                            🚫
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={30} onPage={setPage} />
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Detalle de Venta"
        maxWidth={500}
      >
        {detail && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                ["Total", fmt(detail.total)],
                [
                  "Método",
                  detail.payment_method === "sinpe"
                    ? "📱 SINPE"
                    : "💵 Efectivo",
                ],
                detail.payment_method === "efectivo" && detail.change_given
                  ? ["Cambio", fmt(detail.change_given)]
                  : null,
                detail.sinpe_description
                  ? ["Referencia SINPE", detail.sinpe_description]
                  : null,
                ["Recibido por", detail.received_by || "—"],
                ["Cajero", detail.user_name || "—"],
                ["Fecha", fmtDateTime(detail.created_at)],
                ["Estado", detail.status],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: "var(--surface2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        marginBottom: 2,
                      }}
                    >
                      {k}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v}</div>
                  </div>
                ))}
            </div>

            {/* ── Foto comprobante SINPE ── */}
            {detail.sinpe_photo && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  📷 Comprobante SINPE
                </div>
                <img
                  src={detail.sinpe_photo}
                  alt="Comprobante SINPE"
                  onClick={() => setPhotoModal(detail.sinpe_photo)}
                  style={{
                    width: "100%",
                    maxHeight: 260,
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1.5px solid var(--border)",
                    cursor: "pointer",
                    display: "block",
                    background: "var(--surface2)",
                  }}
                />
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text3)",
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  Toca para ampliar ·{" "}
                  <a
                    href={detail.sinpe_photo}
                    download="comprobante-sinpe.jpg"
                    style={{
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    ⬇️ Descargar
                  </a>
                </div>
              </div>
            )}

            {/* ── Artículos ── */}
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
              Artículos
            </div>
            {(detail.items || []).filter(Boolean).map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                  <span style={{ color: "var(--text3)", fontSize: 12 }}>
                    {" "}
                    × {item.quantity}
                  </span>
                </div>
                <div style={{ fontWeight: 700 }}>{fmt(item.subtotal)}</div>
              </div>
            ))}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                Cerrar
              </button>
              {isAdmin() && detail.status === "completada" && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setDetail(null);
                    setConfirm(detail.id);
                  }}
                >
                  🚫 Anular Venta
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ── Photo fullscreen ── */}
      <Modal
        open={!!photoModal}
        onClose={() => setPhotoModal(null)}
        title="📷 Comprobante SINPE"
        maxWidth={640}
      >
        {photoModal && (
          <>
            <img
              src={photoModal}
              alt="Comprobante"
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--border)",
                display: "block",
              }}
            />
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <a
                href={photoModal}
                download="comprobante-sinpe.jpg"
                className="btn btn-ghost"
              >
                ⬇️ Descargar
              </a>
              <button
                className="btn btn-accent"
                onClick={() => setPhotoModal(null)}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Confirmar anulación ── */}
      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title="🚫 Anular Venta"
          maxWidth={400}
        >
          <div
            style={{
              background: "var(--red-light)",
              border: "1px solid #f5c6c3",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            ⚠️ El stock de los productos será restaurado automáticamente.
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20 }}>
            ¿Confirmas que deseas anular esta venta?
          </p>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={() => cancel(confirm)}>
              🚫 Anular
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
