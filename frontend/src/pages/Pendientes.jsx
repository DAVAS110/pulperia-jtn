import React, { useState, useEffect, useCallback } from "react";
import { debtsAPI } from "../services/api";
import { Modal, Spinner, EmptyState, Pagination } from "../components/ui";
import PaymentModal from "../components/PaymentModal";
import { toast } from "../store/toastStore";
import { fmt, fmtDateTime } from "../utils/helpers";
import {
  FiClock,
  FiDollarSign,
  FiSmartphone,
  FiCamera,
  FiEye,
  FiDownload,
  FiCreditCard,
} from "react-icons/fi";

export default function Pendientes() {
  const [status, setStatus] = useState("pendiente");
  const [debts, setDebts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [paying, setPaying] = useState(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await debtsAPI.list({ status, page, limit: 30 });
      setDebts(data.debts);
      setTotal(data.total);
    } catch {
      toast.error("Error al cargar pendientes");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPendiente = debts.reduce((s, d) => s + parseFloat(d.amount), 0);

  const confirmPay = async (payment) => {
    if (!paying) return;
    setProcessing(true);
    try {
      await debtsAPI.pay(paying.id, payment);
      toast.success(`Deuda de ${paying.customer_name} cobrada`);
      setPaying(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al cobrar deuda");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pendientes</h1>
          <p>Deudas / fiado de clientes</p>
        </div>
      </div>

      <div className="filters-bar">
        <button
          className={`btn btn-sm ${status === "pendiente" ? "btn-accent" : "btn-ghost"}`}
          onClick={() => {
            setStatus("pendiente");
            setPage(1);
          }}
        >
          <FiClock /> Pendientes
        </button>
        <button
          className={`btn btn-sm ${status === "pagada" ? "btn-accent" : "btn-ghost"}`}
          onClick={() => {
            setStatus("pagada");
            setPage(1);
          }}
        >
          Historial
        </button>
        {debts.length > 0 && (
          <div style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15 }}>
            Total: <span style={{ color: "var(--accent)" }}>{fmt(totalPendiente)}</span>
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : debts.length === 0 ? (
          <EmptyState
            icon={<FiClock />}
            title={status === "pendiente" ? "No hay pendientes" : "Sin historial"}
            description={
              status === "pendiente"
                ? 'Las deudas aparecerán aquí cuando se use "Dejar pendiente" en Caja'
                : "Las deudas cobradas aparecerán aquí"
            }
          />
        ) : (
          <>
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Fecha</th>
                  <th>Artículos</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text3)" }}>
                      {d.customer_phone || "—"}
                    </td>
                    <td
                      style={{
                        fontSize: 12.5,
                        color: "var(--text2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDateTime(d.created_at)}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {(d.items || []).filter(Boolean).length} artículo(s)
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 15 }}>{fmt(d.amount)}</td>
                    <td>
                      <span
                        className={`badge ${d.status === "pagada" ? "badge-green" : "badge-red"}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          className="btn-icon"
                          onClick={() => setDetail(d)}
                          title="Ver detalle"
                        >
                          <FiEye />
                        </button>
                        {d.status === "pendiente" && (
                          <button
                            className="btn-icon"
                            onClick={() => setPaying(d)}
                            title="Cobrar"
                          >
                            <FiCreditCard />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="debt-cards mobile-only">
            {debts.map((d) => (
              <div className="d-card" key={d.id}>
                <div className="d-main">
                  <div className="d-top">
                    <span className="d-name">{d.customer_name}</span>
                    <span
                      className={`badge ${d.status === "pagada" ? "badge-green" : "badge-red"}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="d-meta">
                    {fmtDateTime(d.created_at)} ·{" "}
                    {(d.items || []).filter(Boolean).length} artículo(s)
                    {d.customer_phone ? ` · ${d.customer_phone}` : ""}
                  </div>
                </div>
                <div className="d-amount">{fmt(d.amount)}</div>
                <div className="d-actions">
                  <button
                    className="btn-icon"
                    onClick={() => setDetail(d)}
                    title="Ver detalle"
                  >
                    <FiEye />
                  </button>
                  {d.status === "pendiente" && (
                    <button
                      className="btn-icon"
                      onClick={() => setPaying(d)}
                      title="Cobrar"
                    >
                      <FiCreditCard />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} total={total} limit={30} onPage={setPage} />
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Detalle de Pendiente"
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
                ["Cliente", detail.customer_name],
                ["Teléfono", detail.customer_phone || "—"],
                ["Monto", fmt(detail.amount)],
                ["Estado", detail.status],
                ["Creada", fmtDateTime(detail.created_at)],
                detail.status === "pagada"
                  ? ["Cobrada", fmtDateTime(detail.paid_at)]
                  : null,
                detail.status === "pagada"
                  ? [
                      "Método de cobro",
                      detail.paid_payment_method === "sinpe" ? (
                        <>
                          <FiSmartphone /> SINPE
                        </>
                      ) : (
                        <>
                          <FiDollarSign /> Efectivo
                        </>
                      ),
                    ]
                  : null,
                detail.paid_received_by
                  ? ["Recibido por", detail.paid_received_by]
                  : null,
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

            {detail.paid_sinpe_photo && (
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
                  <FiCamera /> Comprobante SINPE
                </div>
                <img
                  src={detail.paid_sinpe_photo}
                  alt="Comprobante SINPE"
                  onClick={() => setPhotoModal(detail.paid_sinpe_photo)}
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
                    href={detail.paid_sinpe_photo}
                    download="comprobante-sinpe.jpg"
                    style={{
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <FiDownload /> Descargar
                  </a>
                </div>
              </div>
            )}

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

            {detail.status === "pendiente" && (
              <div className="modal-footer">
                <button
                  className="btn btn-accent"
                  onClick={() => {
                    setPaying(detail);
                    setDetail(null);
                  }}
                >
                  <FiCreditCard /> Cobrar
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Photo fullscreen ── */}
      <Modal
        open={!!photoModal}
        onClose={() => setPhotoModal(null)}
        title={
          <>
            <FiCamera /> Comprobante SINPE
          </>
        }
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
                <FiDownload /> Descargar
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

      {/* ── Cobrar pendiente (mismo modal de pago que Caja) ── */}
      <PaymentModal
        open={!!paying}
        onClose={() => setPaying(null)}
        onConfirm={confirmPay}
        processing={processing}
        total={paying ? parseFloat(paying.amount) : 0}
        items={(paying?.items || []).filter(Boolean).map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          price: parseFloat(i.unit_price),
        }))}
        title={paying ? `Cobrar a ${paying.customer_name}` : "Cobrar"}
        confirmLabel="✅ Confirmar Cobro"
      />
    </>
  );
}
