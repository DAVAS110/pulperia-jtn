import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { Spinner, StatCard } from '../components/ui';
import { fmt, downloadCSV } from '../utils/helpers';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top' } },
  scales: { y: { beginAtZero: true, grid: { color: '#f5f0e8' } }, x: { grid: { display: false } } }
};

export default function Reportes() {
  const [dash, setDash] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [invReport, setInvReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const [d, s, i] = await Promise.all([
        reportsAPI.dashboard(),
        reportsAPI.sales({ date_from: dateFrom, date_to: dateTo }),
        reportsAPI.inventory(),
      ]);
      setDash(d.data); setSalesReport(s.data); setInvReport(i.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const exportInventory = () => {
    if (!invReport) return;
    downloadCSV(invReport.products.map((p) => ({
      Nombre: p.name, SKU: p.sku, Categoría: p.category_name || '', 'Precio Venta': p.sale_price,
      Costo: p.cost_price, Stock: p.stock, 'Stock Mínimo': p.min_stock,
      'Valor Stock': p.stock_value, Estado: p.low_stock ? 'Bajo Stock' : 'OK'
    })), 'inventario.csv');
  };

  const exportSales = () => {
    if (!salesReport) return;
    downloadCSV(salesReport.top_products.map((p) => ({
      Producto: p.product_name, SKU: p.product_sku,
      'Cantidad Vendida': p.total_quantity, 'Ingresos': p.total_revenue
    })), 'ventas_productos.csv');
  };

  if (loading) return <Spinner />;

  const salesDates = (salesReport?.sales_by_date || []).map((d) => new Date(d.period).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }));
  const salesTotals = (salesReport?.sales_by_date || []).map((d) => parseFloat(d.total));
  const salesCounts = (salesReport?.sales_by_date || []).map((d) => d.count);

  const catNames = (invReport?.by_category || []).map((c) => c.category_name);
  const catValues = (invReport?.by_category || []).map((c) => parseFloat(c.total_value));
  const catColors = (invReport?.by_category || []).map((c) => c.color);

  const topProds = (salesReport?.top_products || []).slice(0, 8);

  return (
    <>
      <div className="page-header">
        <div><h1>Reportes</h1><p>Análisis de ventas e inventario</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportInventory}>⬇️ CSV Inventario</button>
          <button className="btn btn-ghost" onClick={exportSales}>⬇️ CSV Ventas</button>
        </div>
      </div>

      {/* Date filter */}
      <div className="filters-bar" style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>Período:</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Sora,sans-serif', fontSize: 13, outline: 'none' }} />
        <span style={{ color: 'var(--text3)' }}>→</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Sora,sans-serif', fontSize: 13, outline: 'none' }} />
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="📦" label="Productos" value={dash?.total_products ?? 0} iconBg="#dbeafe" />
        <StatCard icon="💰" label="Valor Inventario" value={fmt(dash?.stock_value)} iconBg="#d4eddf" />
        <StatCard icon="⚠️" label="Bajo Stock" value={dash?.low_stock_count ?? 0} iconBg="#fde8e6" />
        <StatCard icon="🧾" label="Ventas Hoy" value={fmt(dash?.sales_today?.total)} sub={`${dash?.sales_today?.count ?? 0} transacciones`} iconBg="#fef3c7" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📈 Ventas por Día</div>
          <div style={{ height: 240 }}>
            {salesDates.length > 0 ? (
              <Line data={{
                labels: salesDates,
                datasets: [{
                  label: 'Ventas (₡)', data: salesTotals, fill: true,
                  borderColor: '#c8570a', backgroundColor: '#c8570a18',
                  tension: 0.4, pointRadius: 4, pointBackgroundColor: '#c8570a'
                }]
              }} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, tooltip: { callbacks: { label: (c) => '₡' + c.raw.toLocaleString() } } } }} />
            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>Sin datos en el período</div>}
          </div>
        </div>

        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📂 Valor por Categoría</div>
          <div style={{ height: 240 }}>
            {catNames.length > 0 ? (
              <Doughnut data={{
                labels: catNames,
                datasets: [{ data: catValues, backgroundColor: catColors.map((c) => c + 'bb'), borderColor: catColors, borderWidth: 2 }]
              }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, cutout: '60%' }} />
            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>Sin datos</div>}
          </div>
        </div>
      </div>

      {/* Top products */}
      {topProds.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>🏆 Productos Más Vendidos</h3></div>
          <div style={{ padding: '0 20px 20px', height: 260 }}>
            <Bar data={{
              labels: topProds.map((p) => p.product_name.length > 20 ? p.product_name.slice(0, 20) + '…' : p.product_name),
              datasets: [{ label: 'Unidades vendidas', data: topProds.map((p) => p.total_quantity), backgroundColor: '#c8570acc', borderColor: '#c8570a', borderWidth: 2, borderRadius: 6 }]
            }} options={{ ...chartOpts, indexAxis: 'y', plugins: { legend: { display: false } } }} />
          </div>
        </div>
      )}

      {/* Payment methods */}
      {salesReport?.payment_methods?.length > 0 && (
        <div className="card card-body" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>💳 Métodos de Pago</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {salesReport.payment_methods.map((m) => (
              <div key={m.payment_method} style={{ flex: 1, minWidth: 160, background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{m.payment_method === 'efectivo' ? '💵' : '💳'}</div>
                <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{m.payment_method}</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent)', marginTop: 4 }}>{fmt(m.total)}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{m.count} transacciones</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="card">
        <div className="card-header"><h3>📦 Estado del Inventario</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Valor Stock</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {(invReport?.products || []).map((p) => (
                <tr key={p.id}>
                  <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{p.sku}</div></td>
                  <td>{p.category_name ? <span className="badge" style={{ background: p.category_color + '22', color: p.category_color }}>{p.category_name}</span> : '—'}</td>
                  <td>{fmt(p.sale_price)}</td>
                  <td style={{ fontWeight: 700, color: p.low_stock ? 'var(--red)' : 'inherit' }}>{p.stock}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(p.stock_value)}</td>
                  <td><span className={`badge ${p.low_stock ? 'badge-red' : 'badge-green'}`}>{p.low_stock ? '⚠️ Bajo' : '✓ OK'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
