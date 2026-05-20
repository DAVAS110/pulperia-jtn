import React, { useState, useEffect } from "react";
import { combosAPI, productsAPI } from "../services/api";
import { Modal, ConfirmDialog, EmptyState, Spinner } from "../components/ui";
import { toast } from "../store/toastStore";
import { fmt } from "../utils/helpers";
import useAuthStore from "../store/authStore";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  items: [],
};

export default function Combos() {
  const { isAdmin } = useAuthStore();
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await combosAPI.listAll();
      setCombos(data.combos);
    } catch {
      toast.error("Error al cargar combos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    productsAPI
      .list({ limit: 500 })
      .then(({ data }) => setProducts(data.products));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || "",
      price: c.price,
      image_url: c.image_url || "",
      items: (c.items || []).map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        product_name: i.product_name,
      })),
    });
    setModal(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { product_id: "", quantity: 1, product_name: "" }],
    }));
  };

  const updateItem = (idx, key, val) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== idx) return item;
        if (key === "product_id") {
          const prod = products.find((p) => p.id === val);
          return { ...item, product_id: val, product_name: prod?.name || "" };
        }
        return { ...item, [key]: val };
      }),
    }));
  };

  const removeItem = (idx) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  // Auto-calculate suggested price
  const suggestedPrice = form.items.reduce((sum, item) => {
    const prod = products.find((p) => p.id === item.product_id);
    return (
      sum +
      (prod ? parseFloat(prod.sale_price) * (parseInt(item.quantity) || 1) : 0)
    );
  }, 0);

  const save = async () => {
    if (!form.name.trim()) return toast.error("El nombre es requerido");
    if (!form.price || parseFloat(form.price) <= 0)
      return toast.error("El precio debe ser mayor a 0");
    if (form.items.length < 2)
      return toast.error("Un combo debe tener al menos 2 productos");
    if (form.items.some((i) => !i.product_id))
      return toast.error("Selecciona todos los productos");

    setSaving(true);
    try {
      if (editing) await combosAPI.update(editing.id, form);
      else await combosAPI.create(form);
      toast.success(editing ? "Combo actualizado" : "Combo creado");
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await combosAPI.delete(id);
      toast.success("Combo eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
    setConfirm(null);
  };

  const toggle = async (combo) => {
    try {
      await combosAPI.update(combo.id, { is_active: !combo.is_active });
      toast.success(combo.is_active ? "Combo desactivado" : "Combo activado");
      load();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Combos / Ofertas</h1>
          <p>{combos.filter((c) => c.is_active).length} combos activos</p>
        </div>
        {isAdmin() && (
          <button className="btn btn-accent" onClick={openNew}>
            + Nuevo Combo
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : combos.length === 0 ? (
        <EmptyState
          icon="🎁"
          title="No hay combos"
          description="Crea combos para ofrecer paquetes especiales a tus clientes"
          action={
            isAdmin() && (
              <button className="btn btn-accent" onClick={openNew}>
                + Nuevo Combo
              </button>
            )
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))",
            gap: 16,
          }}
        >
          {combos.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ opacity: c.is_active ? 1 : 0.6 }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: "var(--accent-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    "🎁"
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {c.name}
                    {!c.is_active && (
                      <span
                        className="badge badge-gray"
                        style={{ fontSize: 10 }}
                      >
                        Inactivo
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {c.description}
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 20,
                      color: "var(--accent)",
                      marginTop: 6,
                    }}
                  >
                    {fmt(c.price)}
                  </div>
                </div>
              </div>

              {/* Productos del combo */}
              <div style={{ padding: "10px 18px" }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text3)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Incluye
                </div>
                {(c.items || []).map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--accent)",
                        fontWeight: 700,
                        minWidth: 20,
                      }}
                    >
                      ×{item.quantity}
                    </span>
                    <span>{item.product_name}</span>
                    <span
                      style={{
                        color: "var(--text3)",
                        fontSize: 12,
                        marginLeft: "auto",
                      }}
                    >
                      {fmt(parseFloat(item.product_price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {isAdmin() && (
                <div
                  style={{
                    padding: "10px 18px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEdit(c)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className={`btn btn-sm ${c.is_active ? "btn-ghost" : "btn-green"}`}
                    onClick={() => toggle(c)}
                  >
                    {c.is_active ? "🔒 Desactivar" : "🔓 Activar"}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    style={{ marginLeft: "auto" }}
                    onClick={() => setConfirm(c.id)}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Editar Combo" : "Nuevo Combo"}
        maxWidth={580}
      >
        <div className="field">
          <label>Nombre del Combo *</label>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder="Ej: Combo Tarde, Duo Snack…"
          />
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <input
            value={form.description}
            onChange={set("description")}
            placeholder="Ej: Incluye refresco y snack"
          />
        </div>

        {/* Precio */}
        <div className="form-row">
          <div className="field">
            <label>Precio del Combo (₡) *</label>
            <input
              type="number"
              value={form.price}
              onChange={set("price")}
              min="0"
              step="50"
              placeholder="1000"
            />
          </div>
          <div className="field">
            <label>Precio sugerido</label>
            <div
              style={{
                padding: "10px 13px",
                background: "var(--surface2)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text2)",
              }}
            >
              {suggestedPrice > 0 ? fmt(suggestedPrice) : "—"}
              {suggestedPrice > 0 &&
                form.price &&
                parseFloat(form.price) < suggestedPrice && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--green)",
                      marginLeft: 6,
                    }}
                  >
                    ({fmt(suggestedPrice - parseFloat(form.price))} descuento)
                  </span>
                )}
            </div>
          </div>
        </div>

        <div className="field">
          <label>URL de imagen (opcional)</label>
          <input
            value={form.image_url}
            onChange={set("image_url")}
            placeholder="https://…"
          />
        </div>

        {/* Productos */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <label
              style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}
            >
              Productos del Combo * (mínimo 2)
            </label>
            <button className="btn btn-ghost btn-sm" onClick={addItem}>
              + Agregar
            </button>
          </div>

          {form.items.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                color: "var(--text3)",
                fontSize: 13,
                background: "var(--surface2)",
                borderRadius: 8,
              }}
            >
              Agrega al menos 2 productos
            </div>
          )}

          {form.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                alignItems: "center",
              }}
            >
              <select
                value={item.product_id}
                onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Sora,sans-serif",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="">Seleccionar producto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.stock})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={item.quantity}
                min="1"
                max="99"
                onChange={(e) =>
                  updateItem(idx, "quantity", parseInt(e.target.value) || 1)
                }
                style={{
                  width: 60,
                  padding: "9px 8px",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Sora,sans-serif",
                  fontSize: 13,
                  textAlign: "center",
                  outline: "none",
                }}
              />
              <button
                className="btn-icon"
                onClick={() => removeItem(idx)}
                style={{ color: "var(--red)", flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "💾 Guardar Combo"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => del(confirm)}
        title="Eliminar Combo"
        message="¿Eliminar este combo? Los productos no serán afectados."
        danger
      />
    </>
  );
}
