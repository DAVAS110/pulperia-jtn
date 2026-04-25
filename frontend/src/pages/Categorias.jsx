import React, { useState, useEffect } from 'react';
import { categoriesAPI } from '../services/api';
import { Modal, ConfirmDialog, EmptyState, ColorSwatches } from '../components/ui';
import { toast } from '../store/toastStore';
import { PALETTE } from '../utils/helpers';
import useAuthStore from '../store/authStore';

export default function Categorias() {
  const { isAdmin } = useAuthStore();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: PALETTE[0] });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await categoriesAPI.list(); setCats(data.categories); }
    catch { toast.error('Error al cargar categorías'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', color: PALETTE[0] }); setModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, color: c.color }); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (editing) await categoriesAPI.update(editing.id, form);
      else await categoriesAPI.create(form);
      toast.success(editing ? 'Categoría actualizada' : 'Categoría creada');
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    try { await categoriesAPI.delete(id); toast.success('Categoría eliminada'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); }
    setConfirm(null);
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Categorías</h1><p>{cats.length} categorías registradas</p></div>
        {isAdmin() && <button className="btn btn-accent" onClick={openNew}>+ Nueva Categoría</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Cargando…</div>
      ) : cats.length === 0 ? (
        <EmptyState icon="🏷️" title="No hay categorías" description="Crea una categoría para organizar tus productos"
          action={isAdmin() && <button className="btn btn-accent" onClick={openNew}>+ Nueva Categoría</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
          {cats.map((c) => (
            <div className="card" key={c.id} style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: c.color + '22', border: `2px solid ${c.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: c.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.product_count} producto{c.product_count !== 1 ? 's' : ''}</div>
              </div>
              {isAdmin() && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" onClick={() => openEdit(c)}>✏️</button>
                  <button className="btn-icon" onClick={() => setConfirm(c.id)}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Categoría' : 'Nueva Categoría'} maxWidth={420}>
        <div className="field">
          <label>Nombre *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Bebidas" />
        </div>
        <div className="field">
          <label>Color</label>
          <ColorSwatches value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} colors={PALETTE} />
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: form.color }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{form.color}</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => del(confirm)}
        title="Eliminar Categoría" message="¿Eliminar esta categoría? Los productos no serán eliminados." danger />
    </>
  );
}
