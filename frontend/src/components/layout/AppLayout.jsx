import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import useAppStore from "../../store/appStore";
import DailyClosure from "../DailyClosure";
import {
  FiBarChart2,
  FiBox,
  FiTag,
  FiShoppingCart,
  FiGift,
  FiClock,
  FiAlertTriangle,
  FiCreditCard,
  FiRepeat,
  FiDollarSign,
  FiSettings,
  FiHome,
  FiMenu,
  FiLogOut,
} from "react-icons/fi";

const NAV = [
  {
    label: "Principal",
    items: [
      { to: "/", icon: <FiBarChart2 />, label: "Dashboard" },
      { to: "/productos", icon: <FiBox />, label: "Productos" },
      { to: "/categorias", icon: <FiTag />, label: "Categorías" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/caja", icon: <FiShoppingCart />, label: "Caja" },
      { to: "/combos", icon: <FiGift />, label: "Combos" },
      { to: "/pendientes", icon: <FiClock />, label: "Pendientes" },
      {
        to: "/alertas",
        icon: <FiAlertTriangle />,
        label: "Alertas",
        badge: true,
      },
      { to: "/ventas", icon: <FiCreditCard />, label: "Ventas" },
      { to: "/movimientos", icon: <FiRepeat />, label: "Movimientos" },
    ],
  },
  {
    label: "Análisis",
    adminOnly: true,
    items: [{ to: "/tesoreria", icon: <FiDollarSign />, label: "Tesorería" }],
  },
  {
    label: "Sistema",
    adminOnly: true,
    items: [
      { to: "/configuracion", icon: <FiSettings />, label: "Configuración" },
    ],
  },
];

export default function AppLayout({ children }) {
  const { user, logout, isAdmin } = useAuthStore();
  const fetchDashboard = useAppStore((s) => s.fetchDashboard);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    fetchDashboard().then((data) => {
      if (data) {
        setAlertsCount((data.low_stock_count || 0) + (data.expiring_count || 0));
      }
    });
  }, [location.pathname, fetchDashboard]);

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
          <div className="logo-icon">
            <FiHome style={{ color: "white", fontSize: 20 }} />
          </div>
          <div>
            <h2>Pulpería JTN</h2>
            <span>Inventario & Ventas</span>
          </div>
        </div>

        {NAV.filter((section) => !section.adminOnly || isAdmin()).map(
          (section) => (
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
                  {item.badge && alertsCount > 0 && (
                    <span className="nav-badge">{alertsCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ),
        )}

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
              <FiLogOut />
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
              <FiMenu />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Cierre de caja — incluye saldos de tesorería, solo admin */}
            {isAdmin() && <DailyClosure />}

            {/* Alertas: stock bajo + productos por caducar */}
            {alertsCount > 0 && (
              <NavLink to="/alertas" style={{ textDecoration: "none" }}>
                <span className="badge badge-red">
                  ⚠️ {alertsCount} alerta{alertsCount !== 1 ? "s" : ""}
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
