import React, { useState, useEffect, useCallback } from "react";
import { treasuryAPI } from "../../services/api";
import { Modal, StatCard } from "../ui";
import { toast } from "../../store/toastStore";
import { fmt, fmtDateTime } from "../../utils/helpers";
import { FiDollarSign, FiSmartphone, FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import useAuthStore from "../../store/authStore";

const WITHDRAW_CATEGORIES = [
  "Restock / compra de mercadería",
  "Gastos operativos",
  "Luz / electricidad",
  "Agua",
  "Alquiler",
  "Salarios",
  "Retiro del dueño",
  "Otro",
];

const DEPOSIT_CATEGORIES = ["Ajuste manual", "Saldo inicial", "Otro"];

const DIR_COLOR = { entrada: "var(--green)", salida: "var(--red)" };
const DIR_BG = { entrada: "var(--green-light)", salida: "var(--red-light)" };

export default function TreasuryPanel() {
  const { isAdmin } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histTab, setHistTab] = useState("all"); // 'all' | 'caja' | 'sinpe'
  const [movements, setMovements] = useState([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [modal, setModal] = useState(null); // 'withdraw' | 'deposit' | null
  const [form, setForm] = useState({
    account_type: "caja",
    amount: "",
    category: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const { data: d } = await treasuryAPI.getSummary();
      setData(d);
    } catch {
      toast.error("Error al cargar tesorería");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    try {
      const params = { page: movPage, limit: 20 };
      if (histTab !== "all") params.account_type = histTab;
      const { data: d } = await treasuryAPI.listMovements(params);
      setMovements(d.movements);
      setMovTotal(d.total);
    } catch {}
  }, [histTab, movPage]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const openWithdraw = (account_type) => {
    setForm({
      account_type,
      amount: "",
      category: WITHDRAW_CATEGORIES[0],
      description: "",
    });
    setModal("withdraw");
  };
  const openDeposit = (account_type) => {
    setForm({
      account_type,
      amount: "",
      category: DEPOSIT_CATEGORIES[0],
      description: "",
    });
    setModal("deposit");
  };

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0)
      return toast.error("El monto debe ser mayor a 0");
    if (!form.category) return toast.error("Selecciona una categoría");
    setSaving(true);
    try {
      if (modal === "withdraw") await treasuryAPI.withdraw(form);
      else await treasuryAPI.deposit(form);
      toast.success(
        modal === "withdraw" ? "Retiro registrado" : "Ingreso registrado",
      );
      setModal(null);
      loadSummary();
      loadMovements();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const balanceCaja = data?.caja?.balance ?? 0;
  const balanceSinpe = data?.sinpe?.balance ?? 0;
  const totalBalance = balanceCaja + balanceSinpe;
  const monthlySales = data?.monthly_sales ?? 0;
  const monthlyOutflows = data?.monthly_outflows ?? 0;
  const monthlyHistory = data?.monthly_history || [];

  const sortedMonthlyHistory = [...monthlyHistory].sort(
    (a, b) => new Date(b.month_start) - new Date(a.month_start),
  );
  let runningBalance = totalBalance;
  const monthlyHistoryRows = sortedMonthlyHistory.map((row) => {
    const rowWithBalance = {
      ...row,
      balance_end: runningBalance,
    };
    runningBalance -= row.net_change;
    return rowWithBalance;
  });

  return (
    <div>
      {/* ── Stats ── */}
      <div className="stats-grid stats-grid-3" style={{ marginBottom: 16 }}>
        <StatCard
          icon={<FiDollarSign />}
          label="Saldo Total"
          value={loading ? "…" : fmt(totalBalance)}
          sub="Caja + SINPE"
          iconBg="#e6f8ff"
        />
        <StatCard
          icon={<FiTrendingUp />}
          label="Ventas del Mes"
          value={loading ? "…" : fmt(monthlySales)}
          sub="Ventas registradas"
          iconBg="#d4eddf"
        />
        <StatCard
          icon={<FiTrendingDown />}
          label="Salidas del Mes"
          value={loading ? "…" : fmt(monthlyOutflows)}
          sub="Gastos y retiros"
          iconBg="#fde8e6"
        />
      </div>

      {/* ── Account cards ── */}
      <div className="treasury-accounts">
        <div className="account-card" style={{ borderLeftColor: "var(--accent)" }}>
          <div className="account-label">
            <FiDollarSign /> Caja Física
          </div>
          <div className="account-balance">
            {loading ? "…" : fmt(balanceCaja)}
          </div>
          {isAdmin() && (
            <div className="account-actions">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => openDeposit("caja")}
              >
                + Ingresar
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => openWithdraw("caja")}
              >
                − Retirar
              </button>
            </div>
          )}
        </div>

        <div className="account-card" style={{ borderLeftColor: "var(--blue)" }}>
          <div className="account-label">
            <FiSmartphone /> Cuenta SINPE
          </div>
          <div className="account-balance">
            {loading ? "…" : fmt(balanceSinpe)}
          </div>
          {isAdmin() && (
            <div className="account-actions">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => openDeposit("sinpe")}
              >
                + Ingresar
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => openWithdraw("sinpe")}
              >
                − Retirar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly history ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Historial Mensual</h3>
        </div>
        <div className="month-list">
          {monthlyHistoryRows.length === 0 ? (
            <div
              style={{
                padding: "30px 20px",
                textAlign: "center",
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              No hay datos mensuales aún
            </div>
          ) : (
            monthlyHistoryRows.map((row) => (
              <div className="month-row" key={row.month_label}>
                <span className="month-name">{row.month_label}</span>
                <div className="month-figures">
                  <div className="month-figure">
                    <span className="month-figure-label">Saldo</span>
                    <span className="month-figure-value">
                      {fmt(row.balance_end)}
                    </span>
                  </div>
                  <div className="month-figure">
                    <span className="month-figure-label">Ventas</span>
                    <span
                      className="month-figure-value"
                      style={{ color: "var(--green)" }}
                    >
                      {fmt(row.sales)}
                    </span>
                  </div>
                  <div className="month-figure">
                    <span className="month-figure-label">Salidas</span>
                    <span
                      className="month-figure-value"
                      style={{ color: "var(--red)" }}
                    >
                      {fmt(row.outflows)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Movement history ── */}
      <div className="card">
        <div className="card-header history-header">
          <h3>Historial de Movimientos</h3>
          <div className="history-filter-tabs">
            {[
              ["all", "Todos"],
              [
                "caja",
                <>
                  <FiDollarSign /> Caja
                </>,
              ],
              [
                "sinpe",
                <>
                  <FiSmartphone /> SINPE
                </>,
              ],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => {
                  setHistTab(v);
                  setMovPage(1);
                }}
                className={`history-filter-button ${histTab === v ? "active" : ""}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {movements.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            No hay movimientos registrados aún
          </div>
        ) : (
          <>
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td
                      style={{
                        fontSize: 12,
                        color: "var(--text3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDateTime(m.created_at)}
                    </td>
                    <td>
                      <span
                        className={`badge ${m.account_type === "caja" ? "badge-yellow" : "badge-blue"}`}
                      >
                        {m.account_type === "caja" ? (
                          <>
                            <FiDollarSign /> Caja
                          </>
                        ) : (
                          <>
                            <FiSmartphone /> SINPE
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: DIR_BG[m.direction],
                          color: DIR_COLOR[m.direction],
                        }}
                      >
                        {m.direction === "entrada" ? "▲ Entrada" : "▼ Salida"}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text2)" }}>
                      {m.category}
                    </td>
                    <td
                      style={{
                        fontSize: 12.5,
                        color: "var(--text3)",
                        maxWidth: 200,
                      }}
                    >
                      {m.description || "—"}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color:
                          m.direction === "entrada"
                            ? "var(--green)"
                            : "var(--red)",
                        fontSize: 14,
                      }}
                    >
                      {m.direction === "entrada" ? "+" : "−"}
                      {fmt(m.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>
                      {m.user_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="txn-list mobile-only">
            {movements.map((m) => (
              <div className="txn-row" key={m.id}>
                <span
                  className="txn-amount"
                  style={{ color: DIR_COLOR[m.direction] }}
                >
                  {m.direction === "entrada" ? "+" : "−"}
                  {fmt(m.amount)}
                </span>
                <div className="txn-main">
                  <div className="txn-top">
                    <span className="txn-category">{m.category}</span>
                    <span
                      className={`badge ${m.account_type === "caja" ? "badge-yellow" : "badge-blue"}`}
                    >
                      {m.account_type === "caja" ? "Caja" : "SINPE"}
                    </span>
                  </div>
                  <div className="txn-meta">
                    {fmtDateTime(m.created_at)}
                    {m.user_name ? ` · ${m.user_name}` : ""}
                    {m.description ? ` · ${m.description}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {movTotal > 20 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "12px 20px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                disabled={movPage <= 1}
                onClick={() => setMovPage((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text3)",
                }}
              >
                Página {movPage} · {movTotal} movimientos
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={movPage * 20 >= movTotal}
                onClick={() => setMovPage((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* ── Withdraw Modal ── */}
      <Modal
        open={modal === "withdraw"}
        onClose={() => setModal(null)}
        title={
          form.account_type === "caja" ? (
            <>
              <FiDollarSign /> Registrar Retiro — Caja
            </>
          ) : (
            <>
              <FiSmartphone /> Registrar Retiro — SINPE
            </>
          )
        }
        maxWidth={440}
      >
        <div
          style={{
            background: "var(--red-light)",
            border: "1px solid var(--danger-border)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          Saldo actual:{" "}
          <strong>
            {fmt(form.account_type === "caja" ? balanceCaja : balanceSinpe)}
          </strong>
        </div>
        <div className="field">
          <label>Monto a retirar (₡) *</label>
          <input
            type="number"
            value={form.amount}
            min="1"
            step="100"
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Ej: 15000"
          />
        </div>
        <div className="field">
          <label>Categoría / Motivo *</label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            {WITHDRAW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Descripción adicional (opcional)</label>
          <textarea
            value={form.description}
            rows={3}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Ej: Compra de 30 unidades de Coca-Cola al proveedor X…"
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(null)}>
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Registrando…" : "− Registrar Retiro"}
          </button>
        </div>
      </Modal>

      {/* ── Deposit Modal ── */}
      <Modal
        open={modal === "deposit"}
        onClose={() => setModal(null)}
        title={
          form.account_type === "caja" ? (
            <>
              <FiDollarSign /> Registrar Ingreso — Caja
            </>
          ) : (
            <>
              <FiSmartphone /> Registrar Ingreso — SINPE
            </>
          )
        }
        maxWidth={440}
      >
        <div className="field">
          <label>Monto a ingresar (₡) *</label>
          <input
            type="number"
            value={form.amount}
            min="1"
            step="100"
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Ej: 50000"
          />
        </div>
        <div className="field">
          <label>Categoría *</label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            {DEPOSIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea
            value={form.description}
            rows={3}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Ej: Saldo inicial de caja al abrir el negocio…"
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(null)}>
            Cancelar
          </button>
          <button
            className="btn btn-green"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Registrando…" : "+ Registrar Ingreso"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
