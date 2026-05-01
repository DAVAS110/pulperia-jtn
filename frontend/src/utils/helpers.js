export const fmt = (n) =>
  "₡" +
  Number(n || 0).toLocaleString("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const fmtDate = (d) => {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
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
  entrada: "#2d7a4f",
  salida: "#c0392b",
  ajuste: "#1a5fa8",
  pérdida: "#b45309",
  venta: "#9b59b6",
};

export const PALETTE = [
  "#e74c3c",
  "#e67e22",
  "#f39c12",
  "#2ecc71",
  "#1abc9c",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#795548",
  "#607d8b",
];

export const downloadCSV = (data, filename) => {
  const csv = data
    .map((row) =>
      Object.values(row)
        .map((v) => `"${v ?? ""}"`)
        .join(","),
    )
    .join("\n");
  const header = Object.keys(data[0])
    .map((k) => `"${k}"`)
    .join(",");
  const blob = new Blob(["\uFEFF" + header + "\n" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
