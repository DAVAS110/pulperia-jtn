import { useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// ─── Hook principal PWA ───────────────────────────────────
export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Auto-update del service worker
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      console.log("SW registrado:", r);
    },
    onRegisterError(err) {
      console.error("SW error:", err);
    },
  });

  useEffect(() => {
    // Detectar iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Detectar si ya está instalada
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsInstalled(installed);

    // Capturar el prompt de instalación (Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  return {
    canInstall: !!installPrompt || (isIOS && !isInstalled),
    isInstalled,
    isIOS,
    install,
    showIOSGuide,
    setShowIOSGuide,
    needRefresh,
    updateServiceWorker,
  };
}

// ─── Notificaciones Push ──────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendLowStockNotification(products) {
  if (Notification.permission !== "granted") return;
  if (!products?.length) return;

  const count = products.length;
  const names = products
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
  const more = count > 3 ? ` y ${count - 3} más` : "";

  new Notification("⚠️ Stock Bajo — Pulperia JTN", {
    body: `${names}${more} necesitan reposición`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: "low-stock",
    renotify: true,
    requireInteraction: false,
  });
}
