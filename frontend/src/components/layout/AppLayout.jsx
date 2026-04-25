import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import { reportsAPI } from "../../services/api";
import DailyClosure from "../DailyClosure";

const NAV = [
  {
    label: "Principal",
    items: [
      { to: "/", icon: "📊", label: "Dashboard" },
      { to: "/productos", icon: "📦", label: "Productos" },
      { to: "/categorias", icon: "🏷️", label: "Categorías" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/caja", icon: "🛒", label: "Caja / POS" },
      { to: "/ventas", icon: "💳", label: "Ventas" },
      { to: "/movimientos", icon: "🔄", label: "Movimientos" },
      { to: "/alertas", icon: "⚠️", label: "Alertas", badge: true },
    ],
  },
  {
    label: "Análisis",
    items: [
      { to: "/reportes", icon: "📈", label: "Reportes" },
      { to: "/qr", icon: "📷", label: "Códigos QR" },
    ],
  },
  {
    label: "Sistema",
    items: [{ to: "/configuracion", icon: "⚙️", label: "Configuración" }],
  },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    reportsAPI
      .dashboard()
      .then(({ data }) => setLowStockCount(data.low_stock_count || 0))
      .catch(() => {});
  }, [location.pathname]);

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="app-layout">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🏪</div>
          <div>
            <h2>Pulperia JTN</h2>
            <span>Inventario & Ventas</span>
          </div>
        </div>

        {NAV.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && lowStockCount > 0 && (
                  <span className="nav-badge">{lowStockCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="user-info-sidebar">
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.name}
              </strong>
              <span>
                {user?.role === "admin" ? "Administrador" : "Empleado"}
              </span>
            </div>
            <button
              className="logout-btn"
              onClick={logout}
              title="Cerrar sesión"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Cierre de caja — visible para todos */}
            <DailyClosure />

            {/* Alerta bajo stock */}
            {lowStockCount > 0 && (
              <NavLink to="/alertas" style={{ textDecoration: "none" }}>
                <span className="badge badge-red">
                  ⚠️ {lowStockCount} bajo stock
                </span>
              </NavLink>
            )}

            {/* Avatar */}
            <div
              className="avatar"
              style={{ width: 32, height: 32, fontSize: 12 }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
