import React, { useEffect, useState } from "react";
import {
  usePWA,
  requestNotificationPermission,
  sendLowStockNotification,
} from "../hooks/usePWA";
import { productsAPI } from "../services/api.js";
import useAuthStore from "../store/authStore.js";

// ─── Banner de instalación ────────────────────────────────
export function InstallBanner() {
  const {
    canInstall,
    isInstalled,
    isIOS,
    install,
    showIOSGuide,
    setShowIOSGuide,
  } = usePWA();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa-install-dismissed") === "1",
  );

  if (isInstalled || dismissed || !canInstall) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #1a0e04, #2d1507)",
          color: "white",
          borderRadius: 16,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          zIndex: 999,
          maxWidth: 420,
          width: "calc(100% - 40px)",
          animation: "slideUp 0.3s ease",
        }}
      >
        <span style={{ fontSize: 28, flexShrink: 0 }}>🏪</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Instalar Pulperia JTN
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {isIOS
              ? "Agregar a pantalla de inicio"
              : "Instala la app para acceso rápido"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => {
              setDismissed(true);
              localStorage.setItem("pwa-install-dismissed", "1");
            }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Ahora no
          </button>
          <button
            onClick={install}
            style={{
              background: "#c8570a",
              border: "none",
              color: "white",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {isIOS ? "Ver cómo" : "Instalar"}
          </button>
        </div>
      </div>

      {/* Guía iOS */}
      {showIOSGuide && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 28,
              maxWidth: 400,
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: "Fraunces, serif",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              🏪 Instalar en iPhone
            </div>
            <p style={{ fontSize: 13.5, color: "#6b5c42", marginBottom: 20 }}>
              Sigue estos pasos para agregar Pulperia JTN a tu pantalla de
              inicio:
            </p>
            {[
              [
                "1",
                "📤",
                "Toca el botón Compartir",
                "El ícono de cuadro con flecha hacia arriba en Safari",
              ],
              ["2", "📜", "Desplázate hacia abajo", "En el menú que aparece"],
              ["3", "➕", 'Toca "Agregar a inicio"', "Add to Home Screen"],
              [
                "4",
                "✅",
                'Toca "Agregar"',
                "La app aparecerá en tu pantalla de inicio",
              ],
            ].map(([n, icon, title, desc]) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#fdebd0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#a8937a" }}>{desc}</div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowIOSGuide(false)}
              style={{
                width: "100%",
                padding: 13,
                background: "#c8570a",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Toast de actualización disponible ───────────────────
export function UpdateToast() {
  const { needRefresh, updateServiceWorker } = usePWA();
  if (!needRefresh[0]) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 998,
        background: "#1a5fa8",
        color: "white",
        borderRadius: 12,
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        maxWidth: 320,
        animation: "toastIn 0.25s ease",
      }}
    >
      <span style={{ fontSize: 20 }}>🔄</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          Nueva versión disponible
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.8 }}>Toca para actualizar</div>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "white",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        Actualizar
      </button>
    </div>
  );
}

// ─── Botón de notificaciones (para el topbar) ─────────────
export function NotificationButton() {
  const { token } = useAuthStore();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [checking, setChecking] = useState(false);

  if (!("Notification" in window)) return null;

  const enable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
    if (granted) checkLowStock();
  };

  const checkLowStock = async () => {
    if (!token) return;
    setChecking(true);
    try {
      const { data } = await productsAPI.list({ status: "bajo", limit: 50 });
      sendLowStockNotification(data.products);
    } catch {
    } finally {
      setChecking(false);
    }
  };

  if (permission === "granted") {
    return (
      <button
        onClick={checkLowStock}
        title="Verificar alertas de stock"
        disabled={checking}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          padding: "4px 6px",
          borderRadius: 8,
          transition: "all 0.2s",
          opacity: checking ? 0.5 : 1,
        }}
      >
        🔔
      </button>
    );
  }

  if (permission === "denied") return null;

  return (
    <button
      onClick={enable}
      title="Activar notificaciones de bajo stock"
      style={{
        background: "#fef3c7",
        border: "1.5px solid #fde68a",
        borderRadius: 8,
        padding: "6px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: "#b45309",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      🔔 Activar alertas
    </button>
  );
}
