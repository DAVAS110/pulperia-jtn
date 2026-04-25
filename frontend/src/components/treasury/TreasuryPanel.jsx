import React, { useState, useEffect, useCallback } from 'react';
import { treasuryAPI } from '../../services/api';
import { Modal } from '../ui';
import { toast } from '../../store/toastStore';
import { fmt, fmtDateTime } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';

const WITHDRAW_CATEGORIES = [
  'Restock / compra de mercadería',
  'Gastos operativos',
  'Luz / electricidad',
  'Agua',
  'Alquiler',
  'Salarios',
  'Retiro del dueño',
  'Otro',
];

const DEPOSIT_CATEGORIES = [
  'Ajuste manual',
  'Saldo inicial',
  'Otro',
];

const DIR_COLOR = { entrada: 'var(--green)', salida: 'var(--red)' };
const DIR_BG    = { entrada: 'var(--green-light)', salida: 'var(--red-light)' };

export default function TreasuryPanel() {
  const { isAdmin } = useAuthStore();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('caja');        // 'caja' | 'sinpe'
  const [histTab, setHistTab]   = useState('all');         // 'all' | 'caja' | 'sinpe'
  const [movements, setMovements] = useState([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage]   = useState(1);
  const [modal, setModal]       = useState(null);          // 'withdraw' | 'deposit' | null
  const [form, setForm]         = useState({ account_type: 'caja', amount: '', category: '', description: '' });
  const [saving, setSaving]     = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const { data: d } = await treasuryAPI.getSummary();
      setData(d);
    } catch { toast.error('Error al cargar tesorería'); }
    finally { setLoading(false); }
  }, []);

  const loadMovements = useCallback(async () => {
    try {
      const params = { page: movPage, limit: 20 };
      if (histTab !== 'all') params.account_type = histTab;
      const { data: d } = await treasuryAPI.listMovements(params);
      setMovements(d.movements);
      setMovTotal(d.total);
    } catch {}
  }, [histTab, movPage]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  const openWithdraw = (account_type) => {
    setForm({ account_type, amount: '', category: WITHDRAW_CATEGORIES[0], description: '' });
    setModal('withdraw');
  };
  const openDeposit = (account_type) => {
    setForm({ account_type, amount: '', category: DEPOSIT_CATEGORIES[0], description: '' });
    setModal('deposit');
  };

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!form.category) return toast.error('Selecciona una categoría');
    setSaving(true);
    try {
      if (modal === 'withdraw') await treasuryAPI.withdraw(form);
      else await treasuryAPI.deposit(form);
      toast.success(modal === 'withdraw' ? 'Retiro registrado' : 'Ingreso registrado');
      setModal(null);
      loadSummary();
      loadMovements();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const balanceCaja  = data?.caja?.balance  ?? 0;
  const balanceSinpe = data?.sinpe?.balance ?? 0;

  const monthly = (type, dir) => {
    const row = (data?.monthly_totals || []).find(r => r.account_type === type);
    return row ? parseFloat(row[dir === 'in' ? 'total_in' : 'total_out']) : 0;
  };

  return (
    <div style={{ marginTop: 28 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>💰 Tesorería</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Caja física y cuenta SINPE</p>
        </div>
      </div>

      {/* ── Account cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* CAJA */}
        <div className="card" style={{ padding: 22, borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                💵 Caja Física
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: loading ? 'var(--text3)' : 'var(--text)' }}>
                {loading ? '…' : fmt(balanceCaja)}
              </div>
            </div>
            {isAdmin() && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => openDeposit('caja')}>+ Ingresar</button>
                <button className="btn btn-sm btn-danger" onClick={() => openWithdraw('caja')}>− Retirar</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--green-light)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>ENTRADAS MES</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{fmt(monthly('caja','in'))}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--red-light)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>SALIDAS MES</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)' }}>{fmt(monthly('caja','out'))}</div>
            </div>
          </div>
        </div>

        {/* SINPE */}
        <div className="card" style={{ padding: 22, borderLeft: '4px solid var(--blue)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                📱 Cuenta SINPE
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: loading ? 'var(--text3)' : 'var(--text)' }}>
                {loading ? '…' : fmt(balanceSinpe)}
              </div>
            </div>
            {isAdmin() && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => openDeposit('sinpe')}>+ Ingresar</button>
                <button className="btn btn-sm btn-danger" onClick={() => openWithdraw('sinpe')}>− Retirar</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--green-light)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>ENTRADAS MES</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{fmt(monthly('sinpe','in'))}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--red-light)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>SALIDAS MES</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)' }}>{fmt(monthly('sinpe','out'))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Movement history ── */}
      <div className="card">
        <div className="card-header">
          <h3>Historial de Movimientos</h3>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
            {[['all','Todos'],['caja','💵 Caja'],['sinpe','📱 SINPE']].map(([v,l]) => (
              <button key={v}
                onClick={() => { setHistTab(v); setMovPage(1); }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'Sora,sans-serif',
                  background: histTab === v ? 'white' : 'transparent',
                  color: histTab === v ? 'var(--text)' : 'var(--text3)',
                  boxShadow: histTab === v ? 'var(--shadow)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {movements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 }}>
            No hay movimientos registrados aún
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(m.created_at)}
                    </td>
                    <td>
                      <span className={`badge ${m.account_type === 'caja' ? 'badge-yellow' : 'badge-blue'}`}>
                        {m.account_type === 'caja' ? '💵 Caja' : '📱 SINPE'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: DIR_BG[m.direction], color: DIR_COLOR[m.direction] }}>
                        {m.direction === 'entrada' ? '▲ Entrada' : '▼ Salida'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{m.category}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text3)', maxWidth: 200 }}>
                      {m.description || '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: m.direction === 'entrada' ? 'var(--green)' : 'var(--red)', fontSize: 14 }}>
                      {m.direction === 'entrada' ? '+' : '−'}{fmt(m.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{m.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {movTotal > 20 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}>← Anterior</button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                  Página {movPage} · {movTotal} movimientos
                </span>
                <button className="btn btn-ghost btn-sm" disabled={movPage * 20 >= movTotal} onClick={() => setMovPage(p => p + 1)}>Siguiente →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Withdraw Modal ── */}
      <Modal open={modal === 'withdraw'} onClose={() => setModal(null)}
        title={`Registrar Retiro — ${form.account_type === 'caja' ? '💵 Caja' : '📱 SINPE'}`} maxWidth={440}>
        <div style={{ background: 'var(--red-light)', border: '1px solid #f5c6c3', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          Saldo actual: <strong>{fmt(form.account_type === 'caja' ? balanceCaja : balanceSinpe)}</strong>
        </div>
        <div className="field">
          <label>Monto a retirar (₡) *</label>
          <input type="number" value={form.amount} min="1" step="100"
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Ej: 15000" />
        </div>
        <div className="field">
          <label>Categoría / Motivo *</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {WITHDRAW_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Descripción adicional (opcional)</label>
          <textarea value={form.description} rows={3}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Compra de 30 unidades de Coca-Cola al proveedor X…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Registrando…' : '− Registrar Retiro'}
          </button>
        </div>
      </Modal>

      {/* ── Deposit Modal ── */}
      <Modal open={modal === 'deposit'} onClose={() => setModal(null)}
        title={`Registrar Ingreso — ${form.account_type === 'caja' ? '💵 Caja' : '📱 SINPE'}`} maxWidth={440}>
        <div className="field">
          <label>Monto a ingresar (₡) *</label>
          <input type="number" value={form.amount} min="1" step="100"
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Ej: 50000" />
        </div>
        <div className="field">
          <label>Categoría *</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {DEPOSIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea value={form.description} rows={3}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Saldo inicial de caja al abrir el negocio…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn btn-green" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Registrando…' : '+ Registrar Ingreso'}
          </button>
        </div>
      </Modal>
    </div>
  );
}