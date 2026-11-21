import React, { useState, useEffect, useCallback, useMemo } from "react";
import { debtsAPI } from "../services/api";
import { Modal, Spinner, EmptyState, Pagination } from "../components/ui";
import PaymentModal from "../components/PaymentModal";
import EditDebtModal from "../components/EditDebtModal";
import useAuthStore from "../store/authStore";
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
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiEdit2,
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
  const [expanded, setExpanded] = useState(() => new Set());
  const { isAdmin } = useAuthStore();
  const [editing, setEditing] = useState(null); // pendiente cuyos productos se editan
  const [renaming, setRenaming] = useState(null); // grupo cuyo cliente se corrige
  const [renameForm, setRenameForm] = useState({ name: "", phone: "" });
  const [savingRename, setSavingRename] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Los pendientes se agrupan por persona, así que se traen todos de una vez
      const { data } = await debtsAPI.list({
        status,
        page,
        limit: status === "pendiente" ? 200 : 30,
      });
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

  // Agrupa por persona (sin distinguir mayúsculas ni espacios sobrantes)
  const groups = useMemo(() => {
    const map = new Map();
    for (const d of debts) {
      const key = d.customer_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          customer_name: d.customer_name.trim(),
          customer_phone: d.customer_phone,
          debts: [],
          total: 0,
        });
      }
      const g = map.get(key);
      // los pendientes llegan del más nuevo al más viejo: se queda el nombre más antiguo
      g.customer_name = d.customer_name.trim();
      g.debts.push(d);
      g.total += parseFloat(d.amount);
      if (!g.customer_phone && d.customer_phone) g.customer_phone = d.customer_phone;
    }
    return [...map.values()].sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name, "es"),
    );
  }, [debts]);

  const openRename = (g) => {
    setRenameForm({ name: g.customer_name, phone: g.customer_phone || "" });
    setRenaming(g);
  };

  const saveRename = async () => {
    if (!renameForm.name.trim()) return toast.error("Indica el nombre del cliente");
    setSavingRename(true);
    try {
      await debtsAPI.updateCustomer({
        customer_name: renaming.customer_name,
        new_name: renameForm.name.trim(),
        new_phone: renameForm.phone.trim(),
      });
      toast.success("Cliente actualizado");
      setRenaming(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al actualizar el cliente");
    } finally {
      setSavingRename(false);
    }
  };

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirmPay = async (payment) => {
    if (!paying) return;
    setProcessing(true);
    try {
      if (paying.group) {
        await debtsAPI.payCustomer({
          ...payment,
          customer_name: paying.customer_name,
        });
        toast.success(
          `${paying.debts.length} pendiente(s) de ${paying.customer_name} cobrados`,
        );
      } else {
        await debtsAPI.pay(paying.id, payment);
        toast.success(`Deuda de ${paying.customer_name} cobrada`);
      }
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
        ) : status === "pendiente" ? (
          <div className="debt-groups">
            {groups.map((g) => {
              const open = expanded.has(g.key);
              return (
                <div className="debt-group" key={g.key}>
                  <div className="debt-group-head">
                    <button
                      className="debt-group-toggle"
                      onClick={() => toggle(g.key)}
                      aria-expanded={open}
                    >
                      <span className="debt-group-avatar">
                        <FiUser />
                      </span>
                      <span className="debt-group-info">
                        <span className="d-name">{g.customer_name}</span>
                        <span className="d-meta">
                          {g.debts.length} pendiente(s)
                          {g.customer_phone ? ` · ${g.customer_phone}` : ""}
                        </span>
                      </span>
                      {open ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                    <div className="debt-group-total">{fmt(g.total)}</div>
                    <button
                      className="btn-icon"
                      onClick={() => openRename(g)}
                      title="Corregir nombre o teléfono"
                      aria-label="Corregir nombre o teléfono"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => setPaying({ ...g, group: true })}
                    >
                      <FiCreditCard /> Cobrar todo
                    </button>
                  </div>

                  {open && (
                    <div className="debt-group-body">
                      {g.debts.map((d) => (
                        <div className="debt-group-row" key={d.id}>
                          <div className="debt-group-row-main">
                            <div style={{ fontSize: 12.5, color: "var(--text2)" }}>
                              {fmtDateTime(d.created_at)}
                            </div>
                            <div style={{ fontSize: 13 }}>
                              {(d.items || [])
                                .filter(Boolean)
                                .map((i) => `${i.product_name} × ${i.quantity}`)
                                .join(", ") || "—"}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700 }}>{fmt(d.amount)}</div>
                          <button
                            className="btn-icon"
                            onClick={() => setDetail(d)}
                            title="Ver detalle"
                          >
                            <FiEye />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => setEditing(d)}
                            title="Editar productos"
                            aria-label="Editar productos"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => setPaying(d)}
                            title="Cobrar solo este"
                          >
                            <FiCreditCard />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

      {/* ── Editar productos de un pendiente ── */}
      {editing && (
        <EditDebtModal
          debt={editing}
          isAdmin={isAdmin()}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {/* ── Corregir nombre / teléfono del cliente ── */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Corregir cliente"
        maxWidth={420}
      >
        <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 12 }}>
          Se actualiza en todos sus pendientes. Si el nombre ya existe en otro
          cliente, los pendientes quedan unidos en un solo grupo.
        </div>
        <div className="field">
          <label>Nombre</label>
          <input
            type="text"
            value={renameForm.name}
            onChange={(e) => setRenameForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input
            type="text"
            value={renameForm.phone}
            onChange={(e) => setRenameForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setRenaming(null)}>
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={saveRename}
            disabled={savingRename}
          >
            {savingRename ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </Modal>

      {/* ── Cobrar pendiente (mismo modal de pago que Caja) ── */}
      <PaymentModal
        open={!!paying}
        onClose={() => setPaying(null)}
        onConfirm={confirmPay}
        processing={processing}
        total={
          paying
            ? paying.group
              ? paying.total
              : parseFloat(paying.amount)
            : 0
        }
        items={(paying
          ? paying.group
            ? paying.debts.flatMap((d) => d.items || [])
            : paying.items || []
          : []
        )
          .filter(Boolean)
          .map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          price: parseFloat(i.unit_price),
        }))}
        title={
          paying
            ? paying.group
              ? `Cobrar todo a ${paying.customer_name}`
              : `Cobrar a ${paying.customer_name}`
            : "Cobrar"
        }
        confirmLabel={
          <>
            <FiCheckCircle /> Confirmar Cobro
          </>
        }
      />
    </>
  );
}
