import React, { useState, useEffect, useCallback } from 'react';
import { productsAPI, categoriesAPI } from '../services/api';
import { Modal, ConfirmDialog, Spinner, EmptyState, Pagination, ColorSwatches } from '../components/ui';
import { toast } from '../store/toastStore';
import { fmt, PALETTE } from '../utils/helpers';
import useAuthStore from '../store/authStore';

const EMPTY_FORM = { name: '', sku: '', category_id: '', sale_price: '', cost_price: '', stock: 0, min_stock: 5, image_url: '' };

export default function Productos() {
  const { isAdmin } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await productsAPI.list({ search, category_id: catFilter, status: statusFilter, sort, page, limit: 20 });
      setProducts(data.products);
      setTotal(data.total);
    } catch { toast.error('Error al cargar productos'); }
    finally { setLoading(false); }
  }, [search, catFilter, statusFilter, sort, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    categoriesAPI.list().then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new')) openNew();
  }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku, category_id: p.category_id || '', sale_price: p.sale_price, cost_price: p.cost_price, stock: p.stock, min_stock: p.min_stock, image_url: p.image_url || '' });
    setModal(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) return toast.error('Nombre y SKU son requeridos');
    setSaving(true);
    try {
      if (editing) await productsAPI.update(editing.id, form);
      else await productsAPI.create(form);
      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      setModal(false); load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    try {
      await productsAPI.delete(id);
      toast.success('Producto eliminado'); load();
    } catch { toast.error('Error al eliminar'); }
    setConfirm(null);
  };

  const EMOJIS = ['📦','🥤','🥛','🍿','🧴','🌾','🫘','🧃','🧀','🍫','🧹','🧺','🥚','🫙','🍞','🛁','🪥'];

  return (
    <>
      <div className="page-header">
        <div><h1>Productos</h1><p>{total} productos en total</p></div>
        <button className="btn btn-accent" onClick={openNew}>+ Nuevo Producto</button>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <span style={{ color: 'var(--text3)' }}>🔍</span>
          <input placeholder="Buscar por nombre o SKU…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="filter" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Todo el stock</option>
          <option value="ok">Stock OK</option>
          <option value="bajo">Bajo stock</option>
        </select>
        <select className="filter" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Ordenar: Nombre</option>
          <option value="stock">Ordenar: Stock</option>
          <option value="sale_price">Ordenar: Precio</option>
          <option value="created_at">Ordenar: Recientes</option>
        </select>
      </div>

      <div className="card">
        {loading ? <Spinner /> : products.length === 0 ? (
          <EmptyState icon="📦" title="No hay productos" description="Agrega tu primer producto para comenzar"
            action={<button className="btn btn-accent" onClick={openNew}>+ Nuevo Producto</button>} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th><th>Precio Venta</th>
                  <th>Costo</th><th>Stock</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="prod-cell">
                        <div className="prod-img">{p.image_url ? <img src={p.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : '📦'}</div>
                        <div>
                          <div className="prod-name">{p.name}</div>
                          <div className="prod-sku">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.category_name
                        ? <span className="badge" style={{ background: p.category_color + '22', color: p.category_color }}>{p.category_name}</span>
                        : <span className="badge badge-gray">Sin categoría</span>}
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmt(p.sale_price)}</td>
                    <td style={{ color: 'var(--text3)' }}>{fmt(p.cost_price)}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: p.low_stock ? 'var(--red)' : 'inherit' }}>{p.stock}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>/ min {p.min_stock}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.low_stock ? 'badge-red' : 'badge-green'}`}>
                        {p.low_stock ? '⚠️ Bajo' : '✓ OK'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn-icon" onClick={() => openEdit(p)} title="Editar">✏️</button>
                        {isAdmin() && <button className="btn-icon" onClick={() => setConfirm(p.id)} title="Eliminar">🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPage={setPage} />
          </div>
        )}
      </div>

      {/* PRODUCT MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Producto' : 'Nuevo Producto'} maxWidth={600}>
        <div className="form-row">
          <div className="field" style={{ gridColumn: '1/-1' }}>
            <label>Nombre del Producto *</label>
            <input value={form.name} onChange={set('name')} placeholder="Ej: Coca-Cola 600ml" />
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>SKU *</label><input value={form.sku} onChange={set('sku')} placeholder="BEB-001" /></div>
          <div className="field">
            <label>Categoría</label>
            <select value={form.category_id} onChange={set('category_id')}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Precio de Venta (₡)</label><input type="number" value={form.sale_price} onChange={set('sale_price')} placeholder="1000" min="0" step="0.01" /></div>
          <div className="field"><label>Costo (₡)</label><input type="number" value={form.cost_price} onChange={set('cost_price')} placeholder="800" min="0" step="0.01" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Stock Actual</label><input type="number" value={form.stock} onChange={set('stock')} min="0" /></div>
          <div className="field"><label>Stock Mínimo</label><input type="number" value={form.min_stock} onChange={set('min_stock')} min="0" /></div>
        </div>
        <div className="field"><label>URL de Imagen (opcional)</label><input value={form.image_url} onChange={set('image_url')} placeholder="https://…" /></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => del(confirm)}
        title="Eliminar Producto" message="¿Estás seguro? Esta acción no se puede deshacer." danger />
    </>
  );
}
