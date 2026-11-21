import React, { useState, useEffect } from "react";
import { Modal } from "./ui";
import { debtsAPI, productsAPI } from "../services/api";
import { toast } from "../store/toastStore";
import { fmt } from "../utils/helpers";
import { FiMinus, FiPlus, FiTrash2, FiSearch, FiSave } from "react-icons/fi";

// Edita los productos de un pendiente: agregar, cambiar cantidad o quitar.
// Los combos se muestran pero no se pueden editar aquí.
// Solo un admin puede reducir o quitar; cualquiera puede agregar.
export default function EditDebtModal({ debt, isAdmin, onClose, onSaved }) {
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);

  const items = (debt?.items || []).filter(Boolean);
  const comboLines = items.filter((i) => i.product_sku === "COMBO");

  useEffect(() => {
    if (!debt) return;
    // Cada producto puede venir en más de una línea: se juntan en una sola
    const byProduct = new Map();
    for (const i of items.filter((x) => x.product_sku !== "COMBO")) {
      const prev = byProduct.get(i.product_id);
      if (prev) prev.quantity += i.quantity;
      else
        byProduct.set(i.product_id, {
          product_id: i.product_id,
          name: i.product_name,
          unit_price: parseFloat(i.unit_price),
          original: 0,
          quantity: i.quantity,
        });
    }
    const arr = [...byProduct.values()].map((l) => ({ ...l, original: l.quantity }));
    setLines(arr);
    setSearch("");
    setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt]);

  // Búsqueda de productos para agregar (con pausa para no saturar el servidor)
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const { data } = await productsAPI.list({ search: search.trim(), limit: 8 });
        setResults(data.products.filter((p) => p.is_active !== false));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  if (!debt) return null;

  const setQty = (productId, qty) =>
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === productId
          ? {
              ...l,
              // un empleado no puede bajar de lo que ya estaba cargado
              quantity: Math.max(isAdmin ? 0 : l.original, Math.min(9999, qty)),
            }
          : l,
      ),
    );

  const addProduct = (p) => {
    const found = lines.find((l) => l.product_id === p.id);
    if (found) {
      setQty(p.id, found.quantity + 1);
    } else {
      setLines((prev) => [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit_price: parseFloat(p.sale_price),
          original: 0,
          quantity: 1,
        },
      ]);
    }
    setSearch("");
    setResults([]);
  };

  const removeNew = (productId) =>
    setLines((prev) => prev.filter((l) => l.product_id !== productId));

  const changes = lines
    .filter((l) => l.quantity !== l.original)
    .map((l) => ({ product_id: l.product_id, quantity: l.quantity }));

  const total =
    lines.reduce((s, l) => s + l.unit_price * l.quantity, 0) +
    comboLines.reduce((s, c) => s + parseFloat(c.subtotal), 0);
  const remaining = lines.filter((l) => l.quantity > 0).length + comboLines.length;

  const save = async () => {
    if (changes.length === 0) return onClose();
    if (remaining === 0)
      return toast.error(
        "El pendiente no puede quedar vacío. Si ya no corresponde, anula la venta.",
      );
    setSaving(true);
    try {
      await debtsAPI.updateItems(debt.id, changes);
      toast.success("Pendiente actualizado");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!debt}
      onClose={onClose}
      title={`Editar pendiente de ${debt.customer_name}`}
      maxWidth={520}
    >
      <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 12 }}>
        Los productos se descuentan del stock al agregarlos y se devuelven al
        quitarlos.
      </div>

      <div className="field" style={{ position: "relative" }}>
        <label>Agregar producto</label>
        <div style={{ position: "relative" }}>
          <FiSearch
            style={{
              position: "absolute",
              left: 12,
              top: 13,
              color: "var(--text3)",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU…"
            style={{ paddingLeft: 36 }}
          />
        </div>
        {results.length > 0 && (
          <div className="debt-edit-results">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="debt-edit-result"
                onClick={() => addProduct(p)}
                disabled={p.stock <= 0}
              >
                <span>
                  {p.name}
                  <small> · stock {p.stock}</small>
                </span>
                <strong>{fmt(p.sale_price)}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, margin: "14px 0 6px" }}>
        Productos
      </div>
      {lines.map((l) => (
        <div className="debt-edit-line" key={l.product_id}>
          <div className="debt-edit-line-name">
            <span style={{ fontWeight: 600 }}>{l.name}</span>
            <small>
              {fmt(l.unit_price)} c/u
              {l.original === 0 && " · nuevo"}
              {l.original > 0 && l.quantity !== l.original && " · modificado"}
            </small>
          </div>
          <div className="debt-edit-qty">
            <button
              className="btn-icon"
              onClick={() => setQty(l.product_id, l.quantity - 1)}
              disabled={l.quantity <= (isAdmin ? 0 : l.original)}
              aria-label="Restar uno"
            >
              <FiMinus />
            </button>
            <span>{l.quantity}</span>
            <button
              className="btn-icon"
              onClick={() => setQty(l.product_id, l.quantity + 1)}
              aria-label="Sumar uno"
            >
              <FiPlus />
            </button>
          </div>
          <div style={{ fontWeight: 700, minWidth: 70, textAlign: "right" }}>
            {fmt(l.unit_price * l.quantity)}
          </div>
          {l.original === 0 ? (
            <button
              className="btn-icon"
              onClick={() => removeNew(l.product_id)}
              title="Quitar"
              aria-label="Quitar"
            >
              <FiTrash2 />
            </button>
          ) : (
            isAdmin && (
              <button
                className="btn-icon"
                onClick={() => setQty(l.product_id, 0)}
                title="Quitar del pendiente"
                aria-label="Quitar del pendiente"
              >
                <FiTrash2 />
              </button>
            )
          )}
        </div>
      ))}
      {comboLines.map((c, i) => (
        <div className="debt-edit-line" key={`combo-${i}`}>
          <div className="debt-edit-line-name">
            <span style={{ fontWeight: 600 }}>{c.product_name}</span>
            <small>Combo · no se edita aquí</small>
          </div>
          <div className="debt-edit-qty">
            <span>× {c.quantity}</span>
          </div>
          <div style={{ fontWeight: 700, minWidth: 70, textAlign: "right" }}>
            {fmt(c.subtotal)}
          </div>
        </div>
      ))}
      {!isAdmin && (
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
          Solo un administrador puede quitar o reducir productos.
        </div>
      )}

      <div className="debt-edit-total">
        <span>Nuevo total</span>
        <strong>{fmt(total)}</strong>
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn btn-accent"
          onClick={save}
          disabled={saving || changes.length === 0}
        >
          {saving ? (
            "Guardando…"
          ) : (
            <>
              <FiSave /> Guardar cambios
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
