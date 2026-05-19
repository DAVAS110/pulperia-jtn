import { useEffect } from "react";

/**
 * Ejecuta un callback cuando el usuario vuelve a la pestaña/app.
 * No consume recursos cuando la app está en segundo plano.
 */
export function useVisibilityRefresh(callback, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        callback();
      }
    };

    // También refresca al hacer focus en la ventana (útil en desktop)
    const handleFocus = () => callback();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [callback, enabled]);
}
