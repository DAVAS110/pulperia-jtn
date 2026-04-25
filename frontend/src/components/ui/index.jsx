import React from 'react';
import useToastStore from '../../store/toastStore';

// ─── TOAST ────────────────────────────────────────────────
export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => removeToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          {t.type === 'success' ? '✅ ' : t.type === 'error' ? '❌ ' : 'ℹ️ '}
          {t.message}
        </div>
      ))}
    </div>
  );
};

// ─── SPINNER ──────────────────────────────────────────────
export const Spinner = ({ size = 36, center = true }) => (
  <div className={center ? 'loading-center' : ''}>
    <div
      className="spinner"
      style={{ width: size, height: size, margin: center ? '40px auto' : 0 }}
    />
  </div>
);

// ─── MODAL ────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, maxWidth = 560 }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

// ─── CONFIRM DIALOG ───────────────────────────────────────
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, danger }) => (
  <Modal open={open} onClose={onClose} title={title || 'Confirmar'} maxWidth={420}>
    <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>{message}</p>
    <div className="modal-footer">
      <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-accent'}`} onClick={onConfirm}>
        Confirmar
      </button>
    </div>
  </Modal>
);

// ─── EMPTY STATE ──────────────────────────────────────────
export const EmptyState = ({ icon = '📭', title, description, action }) => (
  <div className="empty-state">
    <div className="icon">{icon}</div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

// ─── BADGE ────────────────────────────────────────────────
export const Badge = ({ children, color = 'green' }) => (
  <span className={`badge badge-${color}`}>{children}</span>
);

// ─── STAT CARD ────────────────────────────────────────────
export const StatCard = ({ icon, label, value, sub, iconBg }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

// ─── COLOR SWATCHES ───────────────────────────────────────
export const ColorSwatches = ({ value, onChange, colors }) => (
  <div className="color-swatches">
    {colors.map((c) => (
      <div
        key={c}
        className={`swatch ${value === c ? 'selected' : ''}`}
        style={{ background: c }}
        onClick={() => onChange(c)}
      />
    ))}
  </div>
);

// ─── PAGINATION ───────────────────────────────────────────
export const Pagination = ({ page, total, limit, onPage }) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Anterior</button>
      <span style={{ fontSize: 13, color: 'var(--text3)', flex: 1, textAlign: 'center' }}>
        Página {page} de {totalPages} ({total} total)
      </span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Siguiente →</button>
    </div>
  );
};
