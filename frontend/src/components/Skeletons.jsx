import React from "react";

// ─── CSS para agregar en index.css ────────────────────────
// Pega esto al final de tu index.css:
/*
.skeleton {
  background: linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
*/

// ─── Skeleton base ────────────────────────────────────────
export const Skeleton = ({ width = "100%", height = 16, style = {} }) => (
  <div
    className="skeleton"
    style={{ width, height, borderRadius: 6, ...style }}
  />
);

// ─── Skeleton para stat cards del dashboard ───────────────
export const StatCardSkeleton = () => (
  <div className="stat-card">
    <div
      className="skeleton"
      style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0 }}
    />
    <div style={{ flex: 1 }}>
      <Skeleton width="60%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={28} style={{ marginBottom: 6 }} />
      <Skeleton width="50%" height={11} />
    </div>
  </div>
);

// ─── Skeleton para filas de tabla ────────────────────────
export const TableRowSkeleton = ({ cols = 6, rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} style={{ padding: "14px 16px" }}>
            <Skeleton
              width={j === 0 ? "80%" : j === cols - 1 ? 60 : "60%"}
              height={14}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ─── Skeleton para cards de categorías ────────────────────
export const CategoryCardSkeleton = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))",
      gap: 14,
    }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="card"
        style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}
      >
        <div
          className="skeleton"
          style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Skeleton para la caja/POS ────────────────────────────
export const ProductGridSkeleton = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))",
      gap: 10,
    }}
  >
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="card" style={{ padding: 14 }}>
        <Skeleton
          width={40}
          height={40}
          style={{ margin: "0 auto 10px", borderRadius: 10 }}
        />
        <Skeleton width="85%" height={13} style={{ margin: "0 auto 8px" }} />
        <Skeleton width="60%" height={16} style={{ margin: "0 auto" }} />
      </div>
    ))}
  </div>
);

// ─── Skeleton para actividad del dashboard ────────────────
export const ActivitySkeleton = () => (
  <div style={{ padding: "8px 20px" }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="activity-item">
        <div
          className="skeleton"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        <div style={{ flex: 1 }}>
          <Skeleton width="70%" height={13} style={{ marginBottom: 6 }} />
          <Skeleton width="45%" height={11} />
        </div>
        <Skeleton width={50} height={11} />
      </div>
    ))}
  </div>
);
