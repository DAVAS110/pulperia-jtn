import { useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "";
const PING_INTERVAL = 13 * 60 * 1000; // cada 13 minutos (Render duerme a los 15)

/**
 * Hook que hace ping al backend cada 13 minutos
 * para evitar el "cold start" de Render en plan gratuito
 */
export function useKeepAlive() {
  useEffect(() => {
    if (!API_URL) return;

    const ping = async () => {
      try {
        await fetch(`${API_URL}/health`, { method: "GET" });
      } catch {
        /* silencioso */
      }
    };

    // Ping inmediato al cargar
    ping();

    const interval = setInterval(ping, PING_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
