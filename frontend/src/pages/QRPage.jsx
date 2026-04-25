import React, { useState, useEffect, useRef } from 'react';
import { productsAPI } from '../services/api';
import { Spinner } from '../components/ui';
import { toast } from '../store/toastStore';
import QRCode from 'qrcode';

export default function QRPage() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    productsAPI.list({ limit: 500 })
      .then(({ data }) => { setProducts(data.products); if (data.products[0]) setSelected(data.products[0]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const data = JSON.stringify({ id: selected.id, sku: selected.sku, name: selected.name });
    QRCode.toDataURL(data, { width: 200, margin: 2, color: { dark: '#1a1208', light: '#ffffff' } })
      .then(setQrDataUrl).catch(() => {});
  }, [selected]);

  useEffect(() => () => stopScanner(), []);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { toast.error('No se puede acceder a la cámara'); }
  };

  const stopScanner = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  };

  const handleSkuSearch = async (e) => {
    if (e.key !== 'Enter') return;
    const sku = e.target.value.trim();
    if (!sku) return;
    try {
      const { data } = await productsAPI.getBySku(sku);
      setSelected(data.product);
      setScanResult(`Encontrado: ${data.product.name}`);
      toast.success(`Producto: ${data.product.name}`);
    } catch { setScanResult('Producto no encontrado'); toast.error('SKU no encontrado'); }
  };

  const printQR = () => {
    if (!qrDataUrl || !selected) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>QR – ${selected.name}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;padding:20px}
      h2{margin:16px 0 4px;font-size:18px}p{color:#666;margin:0 0 4px;font-size:13px}</style></head>
      <body><img src="${qrDataUrl}" width="200"><h2>${selected.name}</h2><p>${selected.sku}</p>
      <p>Stock: ${selected.stock} | Precio: ₡${selected.sale_price}</p></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-header"><div><h1>Códigos QR</h1><p>Genera e imprime QR por producto</p></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Product list */}
        <div className="card">
          <div className="card-header"><h3>Productos</h3></div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-input">
              <span style={{ color: 'var(--text3)' }}>🔍</span>
              <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filtered.map((p) => (
              <div key={p.id} onClick={() => setSelected(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: selected?.id === p.id ? 'var(--accent-light)' : 'white', borderBottom: '1px solid var(--border)', transition: 'all 0.15s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.sku}</div>
                </div>
                {selected?.id === p.id && <span style={{ color: 'var(--accent)', fontSize: 14 }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* QR display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selected && (
            <div className="card card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>{selected.sku} · Stock: {selected.stock}</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div className="qr-box">
                  {qrDataUrl && <img src={qrDataUrl} alt="QR Code" style={{ display: 'block', width: 200, height: 200 }} />}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
                Escanea para identificar el producto rápidamente
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={printQR}>🖨️ Imprimir QR</button>
                <button className="btn btn-blue" onClick={scanning ? stopScanner : startScanner}>
                  📷 {scanning ? 'Detener cámara' : 'Escanear'}
                </button>
              </div>
            </div>
          )}

          {/* Scanner */}
          {scanning && (
            <div className="card card-body">
              <div style={{ fontWeight: 700, marginBottom: 12 }}>📷 Escáner de Cámara</div>
              <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>
                {scanResult || 'Apunta la cámara al código QR de un producto…'}
              </div>
            </div>
          )}

          {/* SKU search */}
          <div className="card card-body">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>🔍 Buscar por SKU</div>
            <div className="search-input">
              <span style={{ color: 'var(--text3)' }}>📦</span>
              <input placeholder="Escribe o escanea un SKU y presiona Enter…" onKeyDown={handleSkuSearch} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              También puedes usar un lector de código de barras conectado.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
