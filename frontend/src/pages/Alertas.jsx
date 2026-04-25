import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI } from '../services/api';
import { Spinner, EmptyState } from '../components/ui';
import { fmt } from '../utils/helpers';

export default function Alertas() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    productsAPI.list({ status: 'bajo', limit: 200 })
      .then(({ data }) => setProducts(data.products))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>⚠️ Alertas de Stock</h1>
          <p>{products.length} productos requieren atención</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>¡Todo en orden!</div>
          <div style={{ color: 'var(--text3)', fontSize: 14 }}>No hay productos con stock bajo en este momento.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700 }}>
          {products.map((p) => {
            const pct = Math.min(100, (p.stock / p.min_stock) * 100);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'var(--red-light)', border: '1px solid #f5c6c3',
                borderRadius: 12, padding: '16px 18px'
              }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0' }}>
                    {p.sku} {p.category_name ? `· ${p.category_name}` : ''}
                  </div>
                  <div style={{ background: 'rgba(192,57,43,0.15)', borderRadius: 4, height: 6, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--red)', height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{p.stock}</div>
                  <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>mín: {p.min_stock}</div>
                  <button className="btn btn-sm btn-accent" onClick={() => navigate(`/movimientos?new=entrada`)}>
                    + Reponer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
