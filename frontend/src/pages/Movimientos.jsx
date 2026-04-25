import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, productsAPI } from '../services/api';
import { Modal, Spinner, EmptyState, Pagination } from '../components/ui';
import { toast } from '../store/toastStore';
import { fmt, fmtDateTime, MOVEMENT_LABELS, MOVEMENT_COLORS, MOVEMENT_TYPES } from '../utils/helpers';

export default function Movimientos() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'entrada', quantity: 1, reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.list({ type: typeFilter, page, limit: 30 });
      setMovements(data.movements); setTotal(data.total);
    } catch { toast.error('Error al cargar movimientos'); }
    finally { setLoading(false); }
  }, [typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    productsAPI.list({ limit: 200 }).then(({ data }) => setProducts(data.products));
    const params = new URLSearchParams(window.location.search);
    const t = params.get('new');
    if (t) { setForm((f) => ({ ...f, type: t })); setModal(true); }
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.product_id) return toast.error('Selecciona un producto');
    if (!form.quantity || form.quantity <= 0) return toast.error('La cantidad debe ser mayor a 0');
    setSaving(true);
    try {
      await inventoryAPI.create({ ...form, quantity: parseInt(form.quantity) });
      toast.success('Movimiento registrado');
      setModal(false);
      setForm({ product_id: '', type: 'entrada', quantity: 1, reason: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar'); }
    finally { setSaving(false); }
  };

  const REASONS = {
    entrada: ['Compra a proveedor', 'Ajuste de inventario', 'Devolución de cliente', 'Otro'],
    salida: ['Producto dañado', 'Caducado', 'Muestra', 'Otro'],
    ajuste: ['Conteo físico', 'Corrección de error', 'Otro'],
    pérdida: ['Robo', 'Merma', 'Accidente', 'Otro'],
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Movimientos de Inventario</h1><p>Entradas y salidas de stock</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-green" onClick={() => { setForm((f) => ({ ...f, type: 'entrada' })); setModal(true); }}>▲ Entrada</button>
          <button className="btn btn-danger" onClick={() => { setForm((f) => ({ ...f, type: 'salida' })); setModal(true); }}>▼ Salida</button>
        </div>
      </div>

      <div className="filters-bar">
        <select className="filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
          <option value="venta">Venta</option>
        </select>
      </div>

      <div className="card">
        {loading ? <Spinner /> : movements.length === 0 ? (
          <EmptyState icon="🔄" title="No hay movimientos" description="Registra tu primer movimiento de inventario" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Usuario</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.product_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{m.product_sku}</div></div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: MOVEMENT_COLORS[m.type] + '20', color: MOVEMENT_COLORS[m.type] }}>
                        {MOVEMENT_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: ['entrada'].includes(m.type) ? 'var(--green)' : 'var(--red)', fontSize: 15 }}>
                        {['entrada'].includes(m.type) ? '+' : '-'}{m.quantity}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{m.reason || '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 12.5 }}>{m.user_name || '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDateTime(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={30} onPage={setPage} />
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Movimiento" maxWidth={480}>
        <div className="field">
          <label>Producto *</label>
          <select value={form.product_id} onChange={set('product_id')}>
            <option value="">Seleccionar producto…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Tipo *</label>
            <select value={form.type} onChange={set('type')}>
              {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Cantidad *</label>
            <input type="number" value={form.quantity} onChange={set('quantity')} min="1" />
          </div>
        </div>
        <div className="field">
          <label>Motivo</label>
          <select value={form.reason} onChange={set('reason')}>
            <option value="">Seleccionar motivo…</option>
            {(REASONS[form.type] || REASONS.entrada).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving ? 'Registrando…' : '💾 Registrar'}</button>
        </div>
      </Modal>
    </>
  );
}
