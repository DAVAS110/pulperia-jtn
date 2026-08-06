import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { shiftsAPI, authAPI } from "../services/api";
import { Modal, Spinner } from "../components/ui";
import { toast } from "../store/toastStore";
import useAuthStore from "../store/authStore";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiX,
  FiUsers,
  FiAward,
} from "react-icons/fi";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_LABELS = {
  programado: "Programado",
  cumplido: "Cumplido",
  cambiado: "Cambiado",
  ausente: "Ausente",
};
const STATUS_COLORS = {
  programado: "var(--text3)",
  cumplido: "var(--green)",
  cambiado: "var(--accent2)",
  ausente: "var(--red)",
};

const PERIODS = [
  { value: "month", label: "Este mes" },
  { value: "6m", label: "6 meses" },
  { value: "year", label: "Este año" },
];

const pad2 = (n) => String(n).padStart(2, "0");
const toDateStr = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const isOpenDay = (date) => date.getDay() === 0 || date.getDay() === 4; // Dom o Jue
const lastDayOfMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Rango de fechas para el resumen según el período elegido, anclado al
// mes/año que se está viendo en el calendario.
const periodRange = (year, month, period) => {
  const to = toDateStr(year, month, lastDayOfMonth(year, month));
  if (period === "year") return [`${year}-01-01`, `${year}-12-31`];
  if (period === "6m") {
    let y = year, m = month - 5;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    return [`${y}-${pad2(m + 1)}-01`, to];
  }
  return [`${year}-${pad2(month + 1)}-01`, to];
};

const buildMonthGrid = (year, month) => {
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export default function Horarios() {
  const { isAdmin } = useAuthStore();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayModal, setDayModal] = useState(null); // "YYYY-MM-DD" | null
  const [employees, setEmployees] = useState([]);
  const [addingUserId, setAddingUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState("month");
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Evita que una respuesta vieja (de un mes que ya no estás viendo) pise
  // los datos del mes actual cuando se navega rápido entre meses.
  const loadSeq = useRef(0);
  const summarySeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const { data } = await shiftsAPI.list({
        month: `${year}-${pad2(month + 1)}`,
      });
      if (seq !== loadSeq.current) return; // llegó una carga más nueva primero
      setShifts(data.shifts);
    } catch {
      if (seq === loadSeq.current) toast.error("Error al cargar horarios");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [year, month]);

  // Pequeña espera antes de pedir datos: si el usuario navega varios meses
  // rápido seguido, esto evita disparar una petición por cada click (lo
  // que puede chocar con el límite de lecturas/minuto del backend) — solo
  // se pide una vez que se "asienta" en un mes.
  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    if (dayModal && isAdmin() && employees.length === 0) {
      authAPI
        .listUsers()
        .then(({ data }) =>
          setEmployees(data.users.filter((u) => u.is_active)),
        )
        .catch(() => {});
    }
  }, [dayModal, isAdmin, employees.length]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      const key = s.shift_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [shifts]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Resumen agregado por persona (turnos, ausencias, cambios) para el
  // período elegido — el backend hace el conteo, nunca viajan filas crudas.
  // También con la misma pequeña espera para no disparar una petición por
  // cada click al navegar rápido entre meses.
  useEffect(() => {
    const handle = setTimeout(() => {
      const seq = ++summarySeq.current;
      const [date_from, date_to] = periodRange(year, month, summaryPeriod);
      setSummaryLoading(true);
      shiftsAPI
        .summary({ date_from, date_to })
        .then(({ data }) => {
          if (seq === summarySeq.current) setSummary(data.summary);
        })
        .catch(() => {
          if (seq === summarySeq.current) toast.error("Error al cargar el resumen");
        })
        .finally(() => {
          if (seq === summarySeq.current) setSummaryLoading(false);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [year, month, summaryPeriod]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const openDay = (d) => {
    if (!d) return;
    const date = new Date(year, month, d);
    if (!isOpenDay(date)) return;
    setAddingUserId("");
    setDayModal(toDateStr(year, month, d));
  };

  const dayModalShifts = dayModal ? shiftsByDate[dayModal] || [] : [];
  const dayModalLabel = dayModal
    ? new Date(dayModal + "T00:00:00").toLocaleDateString("es-CR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const addAssignment = async () => {
    if (!addingUserId) return;
    setSaving(true);
    try {
      await shiftsAPI.create({ shift_date: dayModal, user_id: addingUserId });
      setAddingUserId("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al asignar");
    } finally {
      setSaving(false);
    }
  };

  const updateAssignment = async (id, patch) => {
    try {
      await shiftsAPI.update(id, patch);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al actualizar");
    }
  };

  const removeAssignment = async (id) => {
    try {
      await shiftsAPI.delete(id);
      await load();
    } catch {
      toast.error("Error al quitar");
    }
  };

  const availableEmployees = employees.filter(
    (e) => !dayModalShifts.some((s) => s.user_id === e.id),
  );

  // Solo los días de apertura (jueves/domingo) del mes, para la vista móvil
  const openDaysList = cells
    .filter((d) => d && isOpenDay(new Date(year, month, d)))
    .map((d) => ({ day: d, dateStr: toDateStr(year, month, d) }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Horarios</h1>
          <p>Turnos de jueves y domingo</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header schedule-nav">
          <div className="schedule-nav-controls">
            <button className="btn-icon" onClick={() => changeMonth(-1)}>
              <FiChevronLeft />
            </button>
            <button className="btn-icon" onClick={() => changeMonth(1)}>
              <FiChevronRight />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={goToday}>
              Hoy
            </button>
          </div>
          <h3>
            {MONTHS[month]} {year}
          </h3>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="schedule-grid desktop-only">
              {WEEKDAYS.map((w) => (
                <div key={w} className="schedule-weekday">
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="schedule-cell empty" />;
                const date = new Date(year, month, d);
                const open = isOpenDay(date);
                const dateStr = toDateStr(year, month, d);
                const dayShifts = shiftsByDate[dateStr] || [];
                const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <div
                    key={i}
                    className={`schedule-cell ${open ? "open" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => openDay(d)}
                  >
                    <span className="schedule-day-num">{d}</span>
                    {open && (
                      <div className="schedule-chips">
                        {dayShifts.length === 0 ? (
                          <span className="schedule-empty-hint">Sin asignar</span>
                        ) : (
                          dayShifts.map((s) => (
                            <span key={s.id} className="schedule-chip">
                              <span
                                className="schedule-dot"
                                style={{ background: STATUS_COLORS[s.status] }}
                              />
                              {s.user_name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="schedule-list mobile-only">
              {openDaysList.map(({ day, dateStr }) => {
                const dayShifts = shiftsByDate[dateStr] || [];
                const date = new Date(year, month, day);
                return (
                  <div
                    key={dateStr}
                    className="schedule-list-row"
                    onClick={() => openDay(day)}
                  >
                    <div className="schedule-list-date">
                      <strong>{day}</strong>
                      <span>
                        {WEEKDAYS[date.getDay()]}
                      </span>
                    </div>
                    <div className="schedule-chips">
                      {dayShifts.length === 0 ? (
                        <span className="schedule-empty-hint">Sin asignar</span>
                      ) : (
                        dayShifts.map((s) => (
                          <span key={s.id} className="schedule-chip">
                            <span
                              className="schedule-dot"
                              style={{ background: STATUS_COLORS[s.status] }}
                            />
                            {s.user_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header schedule-nav">
          <h3>
            <FiAward /> Resumen
          </h3>
          <div className="history-filter-tabs">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={`history-filter-button ${summaryPeriod === p.value ? "active" : ""}`}
                onClick={() => setSummaryPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {summaryLoading ? (
          <Spinner />
        ) : summary.length === 0 ? (
          <p style={{ padding: "20px 20px", color: "var(--text3)", fontSize: 13 }}>
            No hay turnos registrados en este período.
          </p>
        ) : (
          <div className="schedule-summary">
            {summary.map((u) => (
              <div key={u.user_id} className="schedule-summary-row">
                <span className="schedule-summary-name">{u.name}</span>
                <div className="schedule-summary-figures">
                  <span>
                    <strong>{u.total}</strong> turno{u.total !== 1 ? "s" : ""}
                  </span>
                  {u.cumplido > 0 && (
                    <span style={{ color: "var(--green)" }}>
                      <strong>{u.cumplido}</strong> cumplido
                      {u.cumplido !== 1 ? "s" : ""}
                    </span>
                  )}
                  {u.ausente > 0 && (
                    <span style={{ color: "var(--red)" }}>
                      <strong>{u.ausente}</strong> ausencia
                      {u.ausente !== 1 ? "s" : ""}
                    </span>
                  )}
                  {u.cambiado > 0 && (
                    <span style={{ color: "var(--accent2)" }}>
                      <strong>{u.cambiado}</strong> cambio
                      {u.cambiado !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!dayModal}
        onClose={() => setDayModal(null)}
        title={dayModalLabel}
        maxWidth={480}
      >
        {dayModalShifts.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text3)", marginBottom: 16 }}>
            <FiUsers /> Nadie asignado todavía.
          </p>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {dayModalShifts.map((s) => (
              <div key={s.id} className="schedule-assign-row">
                <div className="schedule-assign-name">{s.user_name}</div>
                {isAdmin() ? (
                  <>
                    <select
                      value={s.status}
                      onChange={(e) =>
                        updateAssignment(s.id, { status: e.target.value })
                      }
                    >
                      {Object.keys(STATUS_LABELS).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                    <input
                      defaultValue={s.note || ""}
                      placeholder="Nota (opcional)"
                      onBlur={(e) => {
                        if (e.target.value !== (s.note || ""))
                          updateAssignment(s.id, { note: e.target.value });
                      }}
                    />
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => removeAssignment(s.id)}
                      title="Quitar"
                    >
                      <FiX />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="badge"
                      style={{
                        background: STATUS_COLORS[s.status] + "20",
                        color: STATUS_COLORS[s.status],
                      }}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                    {s.note && (
                      <span className="schedule-assign-note">{s.note}</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin() && (
          <div className="schedule-add-row">
            <select
              value={addingUserId}
              onChange={(e) => setAddingUserId(e.target.value)}
            >
              <option value="">Agregar persona…</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-accent btn-sm"
              onClick={addAssignment}
              disabled={!addingUserId || saving}
            >
              <FiPlus /> Agregar
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
