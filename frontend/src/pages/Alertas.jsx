import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI } from '../services/api';
import { Spinner } from '../components/ui';
import { fmtDate, daysUntil } from '../utils/helpers';
import { FiAlertTriangle, FiClock, FiCheckCircle } from 'react-icons/fi';

export default function Alertas() {
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      productsAPI.list({ status: 'bajo', limit: 200 }),
      productsAPI.list({ status: 'vencer', sort: 'expiration_date', limit: 200 }),
    ])
      .then(([bajo, vencer]) => {
        setLowStock(bajo.data.products);
        setExpiring(vencer.data.products);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const total = lowStock.length + expiring.length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1><FiAlertTriangle /> Alertas</h1>
          <p>{total} producto(s) requieren atención</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14, color: 'var(--green)', display: 'flex', justifyContent: 'center' }}><FiCheckCircle /></div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>¡Todo en orden!</div>
          <div style={{ color: 'var(--text3)', fontSize: 13.5 }}>No hay productos con stock bajo ni por caducar en este momento.</div>
        </div>
      ) : (
        <>
          {lowStock.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Stock Bajo ({lowStock.length})
              </h3>
              <div className="card" style={{ maxWidth: 700 }}>
                {lowStock.map((p) => {
                  const pct = Math.min(100, (p.stock / p.min_stock) * 100);
                  return (
                    <div key={p.id} className="alert-row-item">
                      <span className="alert-row-icon"><FiAlertTriangle /></span>
                      <div className="alert-row-main">
                        <div className="alert-row-name">{p.name}</div>
                        <div className="alert-row-meta">
                          {p.sku} {p.category_name ? `· ${p.category_name}` : ''}
                        </div>
                        <div className="alert-row-bar">
                          <div className="alert-row-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="alert-row-side">
                        <div className="alert-row-figure">{p.stock} <span>/ mín {p.min_stock}</span></div>
                        <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/movimientos?new=entrada`)}>
                          + Reponer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expiring.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Por Caducar ({expiring.length})
              </h3>
              <div className="card" style={{ maxWidth: 700 }}>
                {expiring.map((p) => {
                  const days = daysUntil(p.expiration_date);
                  return (
                    <div key={p.id} className="alert-row-item">
                      <span className="alert-row-icon"><FiClock /></span>
                      <div className="alert-row-main">
                        <div className="alert-row-name">{p.name}</div>
                        <div className="alert-row-meta">
                          {p.sku} {p.category_name ? `· ${p.category_name}` : ''} · Vence: {fmtDate(p.expiration_date)}
                        </div>
                      </div>
                      <div className="alert-row-side">
                        <div className="alert-row-figure">
                          {days < 0 ? 'Vencido' : `${days} día(s)`}
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/productos`)}>
                          Ver producto
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
