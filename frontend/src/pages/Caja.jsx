import React, { useState, useEffect, useRef } from 'react';
import { productsAPI, salesAPI } from '../services/api';
import { Modal } from '../components/ui';
import { toast } from '../store/toastStore';
import { fmt } from '../utils/helpers';
import { compressImage, formatBytes, base64Size } from '../utils/imageUtils';

export default function Caja() {
  const [products, setProducts]         = useState([]);
  const [search, setSearch]             = useState('');
  const [filtered, setFiltered]         = useState([]);
  const [cart, setCart]                 = useState([]);
  const [payModal, setPayModal]         = useState(false);
  const [payMethod, setPayMethod]       = useState('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [sinpeDescription, setSinpeDescription] = useState('');
  const [receivedBy, setReceivedBy]     = useState('');
  const [sinpePhoto, setSinpePhoto]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [processing, setProcessing]     = useState(false);
  const [lastSale, setLastSale]         = useState(null);
  const [receiptModal, setReceiptModal] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(null);
  const [skuInput, setSkuInput]         = useState('');
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    productsAPI.list({ limit: 500 }).then(({ data }) =>
      setProducts(data.products.filter(p => p.stock > 0))
    );
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered([]); return; }
    const q = search.toLowerCase();
    setFiltered(products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8));
  }, [search, products]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) { toast.error(`Stock máximo: ${product.stock}`); return prev; }
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, sku: product.sku, price: parseFloat(product.sale_price), quantity: 1, maxStock: product.stock, image_url: product.image_url || null }];
    });
    setSearch(''); setFiltered([]);
  };

  const updateQty = (id, delta) => setCart(prev => prev.map(i => {
    if (i.product_id !== id) return i;
    const q = i.quantity + delta;
    if (q <= 0) return null;
    if (q > i.maxStock) { toast.error(`Stock disponible: ${i.maxStock}`); return i; }
    return { ...i, quantity: q };
  }).filter(Boolean));

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.product_id !== id));
  const total  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const change = payMethod === 'efectivo' && cashReceived ? parseFloat(cashReceived) - total : 0;

  const handlePhotoFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('La imagen no puede superar 10MB'); return; }
    try {
      toast.info && toast.info('Comprimiendo imagen...');
      const compressed = await compressImage(file, { maxWidth: 1000, quality: 0.7 });
      const originalSize = formatBytes(file.size);
      const compressedSize = formatBytes(base64Size(compressed));
      setSinpePhoto(compressed);
      setPhotoPreview(compressed);
      toast.success(`Imagen lista (${originalSize} → ${compressedSize})`);
    } catch {
      toast.error('Error al procesar la imagen');
    }
    e.target.value = '';
  };

  const removePhoto = () => { setSinpePhoto(null); setPhotoPreview(null); };

  const openPayModal = () => {
    setSinpeDescription(''); setReceivedBy(''); setCashReceived(''); removePhoto();
    setPayModal(true);
  };

  const handleSkuScan = async (e) => {
    if (e.key !== 'Enter') return;
    const sku = skuInput.trim();
    if (!sku) return;
    try {
      const { data } = await productsAPI.getBySku(sku);
      addToCart(data.product);
      toast.success(`${data.product.name} agregado`);
    } catch { toast.error('Producto no encontrado'); }
    setSkuInput('');
  };

  const confirmSale = async () => {
    if (!cart.length) return toast.error('El carrito está vacío');
    if (payMethod === 'efectivo' && cashReceived && parseFloat(cashReceived) < total) return toast.error('Efectivo insuficiente');
    if (payMethod === 'sinpe' && !receivedBy.trim()) return toast.error('Indica quién recibió el SINPE');
    setProcessing(true);
    try {
      const { data } = await salesAPI.create({
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: payMethod,
        cash_received: payMethod === 'efectivo' && cashReceived ? parseFloat(cashReceived) : null,
        sinpe_description: payMethod === 'sinpe' ? sinpeDescription : null,
        sinpe_photo: payMethod === 'sinpe' ? sinpePhoto : null,
        received_by: receivedBy.trim() || null,
      });
      setLastSale(data.sale);
      setCart([]); setPayModal(false); setReceiptModal(true); setCashReceived('');
      setProducts(prev => prev.map(p => {
        const item = cart.find(i => i.product_id === p.id);
        return item ? { ...p, stock: p.stock - item.quantity } : p;
      }).filter(p => p.stock > 0));
      toast.success('Venta registrada');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar venta'); }
    finally { setProcessing(false); }
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Caja / POS</h1><p>Punto de venta rápido</p></div>
        <input value={skuInput} onChange={e => setSkuInput(e.target.value)} onKeyDown={handleSkuScan}
          placeholder="Escanear QR / código…"
          style={{ padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Sora,sans-serif', fontSize: 13, minWidth: 220, outline: 'none' }} />
      </div>

      <div className="pos-layout">
        <div>
          <div className="search-input" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--text3)' }}>🔍</span>
            <input placeholder="Buscar producto…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          {filtered.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => addToCart(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <div className="prod-img">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      : '📦'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.sku} · Stock: {p.stock}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.sale_price)}</div>
                </div>
              ))}
            </div>
          )}
          {!search && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10 }}>
              {products.slice(0, 48).map(p => (
                <div key={p.id} className="card" onClick={() => addToCart(p)}
                  style={{ padding: 14, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', userSelect: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 8px', overflow: 'hidden', flexShrink: 0 }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '📦'}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>{fmt(p.sale_price)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Stock: {p.stock}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cart-panel">
          <div className="cart-header"><h3>🛒 Carrito ({cart.length})</h3></div>
          <div className="cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
                <p style={{ fontSize: 13 }}>Toca un producto para agregarlo</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product_id} className="cart-item">
                <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '📦'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cart-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div className="cart-item-price">{fmt(item.price)} c/u</div>
                </div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => updateQty(item.product_id, -1)}>−</button>
                  <span className="qty-display">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.product_id, 1)}>+</button>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, minWidth: 64, textAlign: 'right' }}>{fmt(item.price * item.quantity)}</div>
                <button className="btn-icon" style={{ fontSize: 12, width: 26, height: 26 }} onClick={() => removeFromCart(item.product_id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total">
              <span className="cart-total-label">TOTAL</span>
              <span className="cart-total-value">{fmt(total)}</span>
            </div>
            <button className="btn btn-accent" style={{ width: '100%', padding: 14, fontSize: 15, justifyContent: 'center' }}
              onClick={openPayModal} disabled={!cart.length}>💳 Cobrar</button>
            {cart.length > 0 && (
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12, justifyContent: 'center' }}
                onClick={() => setCart([])}>🗑️ Limpiar carrito</button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Confirmar Pago" maxWidth={460}>
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{cart.reduce((s,i)=>s+i.quantity,0)} artículos</span>
            <span style={{ fontWeight: 800, fontSize: 24, color: 'var(--accent)' }}>{fmt(total)}</span>
          </div>
          {cart.map(i => (
            <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2)', marginBottom: 2 }}>
              <span>{i.name} × {i.quantity}</span><span>{fmt(i.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="field">
          <label>Método de Pago</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['efectivo','sinpe'].map(m => (
              <button key={m} className={`btn ${payMethod === m ? 'btn-accent' : 'btn-ghost'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setPayMethod(m); setCashReceived(''); setSinpeDescription(''); setReceivedBy(''); removePhoto(); }}>
                {m === 'efectivo' ? '💵 Efectivo' : '📱 SINPE'}
              </button>
            ))}
          </div>
        </div>

        {payMethod === 'efectivo' && (
          <>
            <div className="field">
              <label>Efectivo Recibido (₡)</label>
              <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                placeholder={total.toString()} min={total} step="100" />
            </div>
            {cashReceived && parseFloat(cashReceived) >= total && (
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>CAMBIO</div>
                <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--green)' }}>{fmt(change)}</div>
              </div>
            )}
          </>
        )}

        {payMethod === 'sinpe' && (
          <>
            <div className="field">
              <label>Descripción / Referencia SINPE</label>
              <input type="text" value={sinpeDescription} onChange={e => setSinpeDescription(e.target.value)}
                placeholder="Ej: SINPE #123456, Juan Pérez…" />
            </div>
            <div className="field">
              <label>📷 Foto del comprobante (opcional)</label>
              {photoPreview ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoPreview} alt="Comprobante"
                    onClick={() => setViewPhotoModal(photoPreview)}
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)', cursor: 'pointer', display: 'block' }} />
                  <button onClick={removePhoto} style={{ position: 'absolute', top: 8, right: 8, background: 'var(--red)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4, textAlign: 'center' }}>Toca para ampliar · Toca ✕ para quitar</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => cameraInputRef.current?.click()}>📷 Cámara</button>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>🖼️ Galería</button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoFile} />
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />
                </div>
              )}
            </div>
          </>
        )}

        <div className="field">
          <label>{payMethod === 'sinpe' ? '¿Quién recibió el SINPE? *' : '¿Quién recibió el pago? (opcional)'}</label>
          <input type="text" value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
            placeholder="Ej: María, Carlos…" />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setPayModal(false)}>Cancelar</button>
          <button className="btn btn-accent" onClick={confirmSale} disabled={processing}>
            {processing ? 'Procesando…' : '✅ Confirmar Venta'}
          </button>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal open={receiptModal} onClose={() => setReceiptModal(false)} title="✅ Venta Exitosa" maxWidth={380}>
        {lastSale && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 28, color: 'var(--green)', marginBottom: 4 }}>{fmt(lastSale.total)}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
              {lastSale.payment_method === 'efectivo' ? '💵 Efectivo' : '📱 SINPE'}
              {lastSale.change_given > 0 && ` · Cambio: ${fmt(lastSale.change_given)}`}
            </div>
            {lastSale.sinpe_description && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Ref: {lastSale.sinpe_description}</div>}
            {lastSale.received_by && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Recibido por: <strong>{lastSale.received_by}</strong></div>}
            {lastSale.sinpe_photo && (
              <img src={lastSale.sinpe_photo} alt="Comprobante"
                onClick={() => setViewPhotoModal(lastSale.sinpe_photo)}
                style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12, cursor: 'pointer', display: 'block' }} />
            )}
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', textAlign: 'left', marginBottom: 20 }}>
              {(lastSale.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{item.product_name} × {item.quantity}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setReceiptModal(false)}>Nueva Venta</button>
          </div>
        )}
      </Modal>

      {/* Photo viewer */}
      <Modal open={!!viewPhotoModal} onClose={() => setViewPhotoModal(null)} title="📷 Comprobante SINPE" maxWidth={600}>
        {viewPhotoModal && (
          <>
            <img src={viewPhotoModal} alt="Comprobante" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', display: 'block' }} />
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <a href={viewPhotoModal} download="comprobante-sinpe.jpg" className="btn btn-ghost">⬇️ Descargar</a>
              <button className="btn btn-accent" onClick={() => setViewPhotoModal(null)}>Cerrar</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}