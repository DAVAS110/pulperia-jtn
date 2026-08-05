export const fmt = (n) =>
  "₡" +
  Number(n || 0).toLocaleString("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const fmtDate = (d) => {
  const date =
    typeof d === "string"
      ? new Date(d.slice(0, 10) + "T00:00:00")
      : new Date(d);
  return date.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString("es-CR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Días restantes hasta una fecha (negativo si ya pasó). Usado para caducidad.
export const daysUntil = (d) => {
  if (!d) return null;
  const target = typeof d === "string" ? new Date(d.slice(0, 10) + "T00:00:00") : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const timeAgo = (d) => {
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return "Ahora mismo";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
};

export const MOVEMENT_TYPES = ["entrada", "salida", "ajuste", "pérdida"];
export const MOVEMENT_LABELS = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  pérdida: "Pérdida",
  venta: "Venta",
};
export const MOVEMENT_COLORS = {
  entrada: "var(--green)",
  salida: "var(--red)",
  ajuste: "var(--blue)",
  pérdida: "var(--yellow)",
  venta: "var(--accent2, #9b59b6)",
};

export const PALETTE = [
  "var(--red)",
  "var(--yellow)",
  "var(--yellow)",
  "var(--green)",
  "var(--green)",
  "var(--blue)",
  "var(--accent2, #9b59b6)",
  "#e91e63",
  "#795548",
  "#607d8b",
];
