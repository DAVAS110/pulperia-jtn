import React, { useState, useEffect, useCallback } from "react";
import { inventoryAPI, productsAPI } from "../services/api";
import { Modal, Spinner, EmptyState, Pagination } from "../components/ui";
import { toast } from "../store/toastStore";
import {
  fmtDateTime,
  MOVEMENT_LABELS,
  MOVEMENT_COLORS,
  MOVEMENT_TYPES,
} from "../utils/helpers";
import {
  FiRepeat,
  FiSave,
  FiSearch,
  FiBox,
  FiX,
  FiPlus,
} from "react-icons/fi";

const EMPTY_FORM = { product_id: "", type: "entrada", quantity: 1, reason: "" };

const REASONS = {
  entrada: [
    "Compra a proveedor",
    "Ajuste de inventario",
    "Devolución de cliente",
    "Otro",
  ],
  salida: ["Producto dañado", "Caducado", "Muestra", "Otro"],
  ajuste: ["Conteo físico", "Corrección de error", "Otro"],
  pérdida: ["Robo", "Merma", "Accidente", "Otro"],
};

export default function Movimientos() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productMatches, setProductMatches] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.list({
        type: typeFilter,
        page,
        limit: 30,
      });
      setMovements(data.movements);
      setTotal(data.total);
    } catch {
      toast.error("Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    productsAPI
      .list({ limit: 200 })
      .then(({ data }) => setProducts(data.products));
    const params = new URLSearchParams(window.location.search);
    const t = params.get("new");
    if (t) {
      setForm((f) => ({ ...f, type: t }));
      setModal(true);
    }
  }, []);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductMatches([]);
      return;
    }
    const q = productSearch.toLowerCase();
    setProductMatches(
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
        )
        .slice(0, 6),
    );
  }, [productSearch, products]);

  const selectedProduct = products.find((p) => p.id === form.product_id);

  const openModal = (type) => {
    setForm({ ...EMPTY_FORM, type });
    setProductSearch("");
    setModal(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickProduct = (p) => {
    setForm((f) => ({ ...f, product_id: p.id }));
    setProductSearch("");
    setProductMatches([]);
  };

  const save = async () => {
    if (!form.product_id) return toast.error("Selecciona un producto");
    if (!form.quantity || form.quantity <= 0)
      return toast.error("La cantidad debe ser mayor a 0");
    setSaving(true);
    try {
      await inventoryAPI.create({ ...form, quantity: parseInt(form.quantity) });
      toast.success("Movimiento registrado");
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Movimientos de Inventario</h1>
          <p>Entradas y salidas de stock</p>
        </div>
        <button className="btn btn-accent" onClick={() => openModal("entrada")}>
          <FiPlus /> Nuevo Movimiento
        </button>
      </div>

      <div className="filters-bar">
        <select
          className="filter"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
          <option value="venta">Venta</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<FiRepeat />}
            title="No hay movimientos"
            description="Registra tu primer movimiento de inventario"
          />
        ) : (
          <>
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                          {m.product_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text3)" }}>
                          {m.product_sku}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: MOVEMENT_COLORS[m.type] + "20",
                          color: MOVEMENT_COLORS[m.type],
                        }}
                      >
                        {MOVEMENT_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: ["entrada"].includes(m.type)
                            ? "var(--green)"
                            : "var(--red)",
                          fontSize: 15,
                        }}
                      >
                        {["entrada"].includes(m.type) ? "+" : "-"}
                        {m.quantity}
                      </span>
                    </td>
                    <td style={{ color: "var(--text2)", fontSize: 13 }}>
                      {m.reason || "—"}
                    </td>
                    <td style={{ color: "var(--text3)", fontSize: 12.5 }}>
                      {m.user_name || "—"}
                    </td>
                    <td
                      style={{
                        color: "var(--text3)",
                        fontSize: 12.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDateTime(m.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="movement-cards mobile-only">
            {movements.map((m) => (
              <div className="mv-card" key={m.id}>
                <span
                  className="mv-qty"
                  style={{
                    color: ["entrada"].includes(m.type)
                      ? "var(--green)"
                      : "var(--red)",
                  }}
                >
                  {["entrada"].includes(m.type) ? "+" : "-"}
                  {m.quantity}
                </span>
                <div className="mv-main">
                  <div className="mv-top">
                    <span className="mv-name">{m.product_name}</span>
                    <span
                      className="badge"
                      style={{
                        background: MOVEMENT_COLORS[m.type] + "20",
                        color: MOVEMENT_COLORS[m.type],
                      }}
                    >
                      {MOVEMENT_LABELS[m.type] || m.type}
                    </span>
                  </div>
                  <div className="mv-meta">
                    {fmtDateTime(m.created_at)}
                    {m.reason ? ` · ${m.reason}` : ""}
                    {m.user_name ? ` · ${m.user_name}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} total={total} limit={30} onPage={setPage} />
          </>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Registrar Movimiento"
        maxWidth={460}
      >
        <div className="field">
          <label>Tipo *</label>
          <div className="type-tabs">
            {MOVEMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`type-tab ${form.type === t ? "active" : ""}`}
                style={
                  form.type === t
                    ? {
                        background: MOVEMENT_COLORS[t] + "1a",
                        borderColor: MOVEMENT_COLORS[t],
                        color: MOVEMENT_COLORS[t],
                      }
                    : undefined
                }
                onClick={() => setForm((f) => ({ ...f, type: t, reason: "" }))}
              >
                {MOVEMENT_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Producto *</label>
          {selectedProduct ? (
            <div className="picked-product">
              <div className="prod-img">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <FiBox />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="prod-name">{selectedProduct.name}</div>
                <div className="prod-sku">
                  {selectedProduct.sku} · Stock: {selectedProduct.stock}
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setForm((f) => ({ ...f, product_id: "" }))}
                title="Cambiar producto"
              >
                <FiX />
              </button>
            </div>
          ) : (
            <>
              <div className="search-input">
                <span style={{ color: "var(--text3)" }}>
                  <FiSearch />
                </span>
                <input
                  placeholder="Buscar producto por nombre o SKU…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {productMatches.length > 0 && (
                <div className="product-picker-list">
                  {productMatches.map((p) => (
                    <div
                      key={p.id}
                      className="product-picker-row"
                      onClick={() => pickProduct(p)}
                    >
                      <div className="prod-img">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <FiBox />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="prod-name">{p.name}</div>
                        <div className="prod-sku">{p.sku}</div>
                      </div>
                      <span className="product-picker-stock">
                        Stock: {p.stock}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-row">
          <div className="field">
            <label>Cantidad *</label>
            <input
              type="number"
              value={form.quantity}
              onChange={set("quantity")}
              min="1"
            />
          </div>
          <div className="field">
            <label>Motivo</label>
            <select value={form.reason} onChange={set("reason")}>
              <option value="">Seleccionar motivo…</option>
              {(REASONS[form.type] || REASONS.entrada).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>
            {saving ? (
              "Registrando…"
            ) : (
              <>
                <FiSave /> Registrar
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
