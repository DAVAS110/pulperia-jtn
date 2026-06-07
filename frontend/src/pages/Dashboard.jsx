import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsAPI } from "../services/api";
import { StatCard } from "../components/ui";
import { StatCardSkeleton, ActivitySkeleton } from "../components/Skeletons";
import TreasuryPanel from "../components/treasury/TreasuryPanel";
import { fmt, timeAgo, MOVEMENT_COLORS } from "../utils/helpers";
import {
  FiShoppingCart,
  FiBox,
  FiDollarSign,
  FiAlertTriangle,
  FiFileText,
  FiRepeat,
  FiTrendingUp,
} from "react-icons/fi";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    reportsAPI
      .dashboard()
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general de tu pulpería</p>
        </div>
        <button className="btn btn-accent" onClick={() => navigate("/caja")}>
          <FiShoppingCart /> Abrir Caja
        </button>
      </div>

      <div className="stats-grid">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<FiBox />}
              label="Total Productos"
              value={data?.total_products ?? 0}
              sub="Productos activos"
              iconBg="#dbeafe"
            />
            <StatCard
              icon={<FiDollarSign />}
              label="Valor del Stock"
              value={fmt(data?.stock_value)}
              sub="Precio venta × cantidad"
              iconBg="#d4eddf"
            />
            <StatCard
              icon={<FiAlertTriangle />}
              label="Bajo Stock"
              value={
                <span
                  style={{
                    color: data?.low_stock_count > 0 ? "var(--red)" : "inherit",
                  }}
                >
                  {data?.low_stock_count ?? 0}
                </span>
              }
              sub="Necesitan reposición"
              iconBg="#fde8e6"
            />
            <StatCard
              icon={<FiFileText />}
              label="Ventas de Hoy"
              value={fmt(data?.sales_today?.total)}
              sub={`${data?.sales_today?.count ?? 0} transacciones`}
              iconBg="#fef3c7"
            />
          </>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Actividad Reciente</h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/movimientos")}
            >
              Ver todo
            </button>
          </div>
          {loading ? (
            <ActivitySkeleton />
          ) : (
            <div className="card-body" style={{ padding: "8px 20px" }}>
              {(data?.recent_activity || []).length === 0 ? (
                <p
                  style={{
                    padding: "20px 0",
                    color: "var(--text3)",
                    fontSize: 13,
                  }}
                >
                  No hay actividad reciente
                </p>
              ) : (
                <div className="activity-list">
                  {(data.recent_activity || []).map((a, i) => (
                    <div className="activity-item" key={i}>
                      <div
                        className="activity-dot"
                        style={{
                          background:
                            a.type === "venta"
                              ? "#9b59b6"
                              : MOVEMENT_COLORS[a.sub_type] || "var(--text3)",
                        }}
                      />
                      <div className="activity-text">
                        {a.type === "venta" ? (
                          <>
                            <strong>Venta registrada</strong> — {a.reason}
                            <div
                              style={{
                                fontSize: 11.5,
                                color: "var(--text3)",
                                marginTop: 1,
                              }}
                            >
                              {a.user_name}
                            </div>
                          </>
                        ) : (
                          <>
                            <strong>{a.product_name}</strong> — {a.sub_type} de{" "}
                            {a.quantity} u.
                            <div
                              style={{
                                fontSize: 11.5,
                                color: "var(--text3)",
                                marginTop: 1,
                              }}
                            >
                              {a.reason} · {a.user_name}
                            </div>
                          </>
                        )}
                      </div>
                      <span className="activity-time">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="dashboard-secondary"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div className="card">
            <div className="card-header">
              <h3>Acciones Rápidas</h3>
            </div>
            <div className="card-body quick-actions">
              {[
                { icon: <FiShoppingCart />, label: "Nueva Venta", to: "/caja" },
                {
                  icon: <FiBox />,
                  label: "Agregar Producto",
                  to: "/productos",
                },
                {
                  icon: <FiRepeat />,
                  label: "Entrada de Stock",
                  to: "/movimientos",
                },
                {
                  icon: <FiTrendingUp />,
                  label: "Ver Reportes",
                  to: "/reportes",
                },
              ].map((a) => (
                <button
                  key={a.to}
                  className="btn btn-ghost quick-action-button"
                  onClick={() => navigate(a.to)}
                >
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!loading && data?.low_stock_count > 0 && (
            <div className="card" style={{ border: "1.5px solid #f5c6c3" }}>
              <div
                className="card-header"
                style={{ background: "var(--red-light)" }}
              >
                <h3 style={{ color: "var(--red)" }}>
                  <FiAlertTriangle /> Alertas de Stock
                </h3>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => navigate("/alertas")}
                >
                  Ver todo
                </button>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13.5, color: "var(--text2)" }}>
                  <strong>{data.low_stock_count}</strong> producto
                  {data.low_stock_count !== 1 ? "s" : ""} con stock bajo el
                  mínimo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <TreasuryPanel />
    </>
  );
}
