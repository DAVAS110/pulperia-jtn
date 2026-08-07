import { useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// ─── Hook principal PWA ───────────────────────────────────
export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [osType, setOsType] = useState("desktop");

  // Auto-update del service worker
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      console.log("[PWA] Service Worker registrado:", r);
      // Verificar actualizaciones cada 60 segundos
      setInterval(() => r?.update(), 60000);
    },
    onRegisterError(err) {
      console.error("[PWA] Error en Service Worker:", err);
    },
  });

  useEffect(() => {
    // Detectar plataforma
    const ua = navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua);
    const Android = /android/.test(ua);

    setIsIOS(iOS);
    setIsAndroid(Android);

    if (iOS) setOsType("ios");
    else if (Android) setOsType("android");
    else setOsType("desktop");

    // Detectar si ya está instalada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    setIsInstalled(isStandalone);
    console.log("[PWA] Detectado:", { iOS, Android, isStandalone });

    // Capturar el prompt de instalación (Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("[PWA] Install prompt capturado (beforeinstallprompt)");
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detectar cuando la app se instala (Android/Desktop)
    const installHandler = () => {
      setIsInstalled(true);
      console.log("[PWA] Aplicación instalada");
    };
    window.addEventListener("appinstalled", installHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installHandler);
    };
  }, []);

  const install = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!installPrompt) {
      console.warn("[PWA] Install prompt no disponible");
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log("[PWA] Resultado instalación:", outcome);

      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } catch (err) {
      console.error("[PWA] Error durante instalación:", err);
    }
  };

  return {
    canInstall: !!installPrompt || (isIOS && !isInstalled),
    isInstalled,
    isIOS,
    isAndroid,
    osType,
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

  new Notification("Stock Bajo — Pulperia JTN", {
    body: `${names}${more} necesitan reposición`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: "low-stock",
    renotify: true,
    requireInteraction: false,
  });
}
