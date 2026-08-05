import React, { useState, useEffect, useRef, useCallback } from "react";
import { productsAPI, salesAPI, combosAPI } from "../services/api";
import { Modal } from "../components/ui";
import PaymentModal from "../components/PaymentModal";
import { toast } from "../store/toastStore";
import { fmt } from "../utils/helpers";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { io } from "socket.io-client";
import {
  FiGift,
  FiSearch,
  FiBox,
  FiShoppingCart,
  FiX,
  FiCheck,
  FiCreditCard,
  FiTrash2,
  FiDollarSign,
  FiSmartphone,
  FiSmile,
  FiClock,
} from "react-icons/fi";

export default function Caja() {
  const [products, setProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [cart, setCart] = useState([]);
  const [payModal, setPayModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receiptModal, setReceiptModal] = useState(false);
  const [activeTab, setActiveTab] = useState("productos"); // 'productos' | 'combos'
  const [debtModal, setDebtModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [savingDebt, setSavingDebt] = useState(false);

  const loadCombos = useCallback(async () => {
    try {
      const { data } = await combosAPI.list();
      setCombos(data.combos || []);
    } catch {}
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await productsAPI.list({ limit: 500 });
      setProducts(data.products.filter((p) => p.stock > 0));
    } catch {}
  }, []);

  useEffect(() => {
    loadProducts();
    loadCombos();
  }, [loadProducts, loadCombos]);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const socketBaseUrl = apiUrl
      ? new URL(apiUrl, window.location.origin).origin
      : window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ? "http://localhost:3001"
      : window.location.origin;

    const socket = io(socketBaseUrl, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Socket conectado", socket.id);
    });

    socket.on("inventory-updated", ({ type }) => {
      loadProducts();
      loadCombos();
      if (!processing) {
        toast.info("Inventario actualizado en otro dispositivo");
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket desconectado", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, [loadProducts, loadCombos, processing]);

  // Cargar carrito desde localStorage al montar (persistencia entre recargas)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) {
        // Normalizar y restaurar
        const normalized = saved.map((it) => ({ ...it }));
        setCart(normalized);
      }
    } catch (e) {
      console.warn("Error cargando carrito desde localStorage", e);
    }
  }, []);

  // Guardar carrito en localStorage cada vez que cambie (opción de bajo costo)
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart || []));
    } catch (e) {
      console.warn("No se pudo guardar el carrito", e);
    }
  }, [cart]);

  // Refresca el stock al volver a la pestaña
  useVisibilityRefresh(() => {
    loadProducts();
    loadCombos();
  });

  useEffect(() => {
    if (!search.trim()) {
      setFiltered([]);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
        )
        .slice(0, 8),
    );
  }, [search, products]);

  const addComboToCart = (combo) => {
    const items = combo.items || [];

    if (items.length === 0) {
      toast.error("Este combo no tiene productos configurados");
      return;
    }

    // Calcular cuántas veces ya está este combo en el carrito
    const comboInCart = cart.find((i) => i.combo_id === combo.id);
    const comboQtyInCart = comboInCart ? comboInCart.quantity : 0;

    // Verificar stock de cada producto considerando todo lo que hay en el carrito
    for (const item of items) {
      // Stock usado por productos individuales en carrito
      const prodInCart = cart.find(
        (i) => i.product_id === item.product_id && !i.isCombo,
      );
      const qtyIndividual = prodInCart ? prodInCart.quantity : 0;

      // Stock usado por este combo ya en carrito
      const qtyByCombo = comboQtyInCart * item.quantity;

      // Stock total necesario si agrego 1 combo más
      const totalNeeded = qtyIndividual + qtyByCombo + item.quantity;

      if (item.product_stock < totalNeeded) {
        toast.error(
          `Stock insuficiente de "${item.product_name}". ` +
            `Disponible: ${item.product_stock}, necesario: ${totalNeeded}`,
        );
        return;
      }
    }

    // Calcular maxStock real del combo
    const maxStock = Math.min(
      ...items.map((i) => {
        const prodInCart = cart.find(
          (c) => c.product_id === i.product_id && !c.isCombo,
        );
        const usedIndividual = prodInCart ? prodInCart.quantity : 0;
        return Math.floor((i.product_stock - usedIndividual) / i.quantity);
      }),
    );

    if (maxStock <= 0) {
      toast.error("No hay stock suficiente para este combo");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.combo_id === combo.id);
      if (existing) {
        if (existing.quantity >= maxStock) {
          toast.error(`Stock máximo para este combo: ${maxStock}`);
          return prev;
        }
        return prev.map((i) =>
          i.combo_id === combo.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          combo_id: combo.id,
          product_id: null,
          name: combo.name,
          sku: "COMBO",
          price: parseFloat(combo.price),
          quantity: 1,
          maxStock,
          isCombo: true,
          comboItems: items,
        },
      ];
    });
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Stock máximo: ${product.stock}`);
          return prev;
        }
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          price: parseFloat(product.sale_price),
          quantity: 1,
          maxStock: product.stock,
          image_url: product.image_url || null,
        },
      ];
    });
    setSearch("");
    setFiltered([]);
  };

  const updateQty = (id, delta) =>
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== id) return i;
          const q = i.quantity + delta;
          if (q <= 0) return null;
          if (q > i.maxStock) {
            toast.error(`Stock disponible: ${i.maxStock}`);
            return i;
          }
          return { ...i, quantity: q };
        })
        .filter(Boolean),
    );

  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const cartPayload = () => ({
    items: cart
      .filter((i) => !i.isCombo)
      .map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    combos: cart
      .filter((i) => i.isCombo)
      .map((i) => ({ combo_id: i.combo_id, quantity: i.quantity })),
  });

  const clearCartAfterSale = async () => {
    // Refrescar productos y combos desde el servidor para evitar inconsistencias
    await loadProducts();
    await loadCombos();
    setCart([]);
    try {
      localStorage.removeItem("cart");
    } catch {}
  };

  const confirmSale = async (payment) => {
    if (!cart.length) return toast.error("El carrito está vacío");
    setProcessing(true);
    try {
      const { data } = await salesAPI.create({ ...cartPayload(), ...payment });
      setLastSale(data.sale);
      await clearCartAfterSale();
      setPayModal(false);
      setReceiptModal(true);
      toast.success("Venta registrada");
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al registrar venta");
    } finally {
      setProcessing(false);
    }
  };

  const openDebtModal = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDebtModal(true);
  };

  const confirmDebt = async () => {
    if (!cart.length) return toast.error("El carrito está vacío");
    if (!customerName.trim())
      return toast.error("Indica el nombre del cliente");
    setSavingDebt(true);
    try {
      await salesAPI.create({
        ...cartPayload(),
        payment_method: "fiado",
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
      });
      await clearCartAfterSale();
      setDebtModal(false);
      toast.success(`Pendiente guardado para ${customerName.trim()}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al dejar pendiente");
    } finally {
      setSavingDebt(false);
    }
  };

  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1>Caja</h1>
        </div>
      </div>

      <div className="pos-layout">
        <div className="pos-products-wrapper">
          <div className="search-input" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--text3)" }}>
              <FiSearch />
            </span>
            <input
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--surface2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "white")
                  }
                >
                  <div className="prod-img">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <FiBox />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>
                      {p.sku} · Stock: {p.stock}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {fmt(p.sale_price)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs productos / combos */}
          {!search && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                onClick={() => setActiveTab("productos")}
                className={`btn btn-sm ${activeTab === "productos" ? "btn-accent" : "btn-ghost"}`}
              >
                <FiBox /> Productos
              </button>
              <button
                onClick={() => setActiveTab("combos")}
                className={`btn btn-sm ${activeTab === "combos" ? "btn-accent" : "btn-ghost"}`}
              >
                <FiGift /> Combos ({combos.length})
              </button>
            </div>
          )}

          {/* Combos grid */}
          {!search && activeTab === "combos" && (
            <div
              className="pos-products-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))",
                gap: 10,
              }}
            >
              {combos.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1/-1",
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text3)",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    <FiGift />
                  </div>
                  <p style={{ fontSize: 13 }}>No hay combos activos</p>
                </div>
              ) : (
                combos.map((c) => (
                  <div
                    key={c.id}
                    className="card"
                    onClick={() => addComboToCart(c)}
                    style={{
                      padding: 14,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s",
                      userSelect: "none",
                      border: "2px solid var(--accent-light)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "";
                      e.currentTarget.style.boxShadow = "";
                    }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 6 }}>
                      <FiGift />
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        color: "var(--accent)",
                        fontSize: 14,
                      }}
                    >
                      {fmt(c.price)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text3)",
                        marginTop: 3,
                      }}
                    >
                      {(c.items || [])
                        .slice(0, 2)
                        .map((i) => i.product_name)
                        .join(" + ")}
                      {(c.items || []).length > 2 ? "…" : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Products grid */}
          {!search && activeTab === "productos" && (
            <div
              className="pos-products-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))",
                gap: 10,
              }}
            >
              {products.slice(0, 48).map((p) => (
                <div
                  key={p.id}
                  className="card"
                  onClick={() => addToCart(p)}
                  style={{
                    padding: 14,
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      margin: "0 auto 8px",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
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
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 12.5,
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      color: "var(--accent)",
                      fontSize: 14,
                    }}
                  >
                    {fmt(p.sale_price)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      marginTop: 3,
                    }}
                  >
                    Stock: {p.stock}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`cart-panel ${cart.length === 0 ? "empty" : ""}`}>
          <div
            className="cart-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ margin: 0 }}>
              <FiShoppingCart /> Carrito ({cart.length})
            </h3>
            {cart.length > 0 && (
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: "var(--accent)",
                }}
              >
                {fmt(total)}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text3)",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                <FiShoppingCart />
              </div>
              <p style={{ fontSize: 13 }}>Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <div
                  key={item.product_id ?? item.combo_id}
                  className="cart-item"
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
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
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{fmt(item.price)} c/u</div>
                  </div>
                  <div className="qty-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product_id, -1)}
                    >
                      −
                    </button>
                    <span className="qty-display">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product_id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      minWidth: 64,
                      textAlign: "right",
                    }}
                  >
                    {fmt(item.price * item.quantity)}
                  </div>
                  <button
                    className="btn-icon"
                    style={{ fontSize: 12, width: 26, height: 26 }}
                    onClick={() => removeFromCart(item.product_id)}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="cart-footer">
            <div className="cart-total">
              <span className="cart-total-label">TOTAL</span>
              <span className="cart-total-value">{fmt(total)}</span>
            </div>
            <button
              className="btn btn-accent"
              style={{
                width: "100%",
                padding: 14,
                fontSize: 15,
                justifyContent: "center",
              }}
              onClick={() => setPayModal(true)}
              disabled={!cart.length}
            >
              <FiCreditCard /> Cobrar
            </button>
            {cart.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{
                  width: "100%",
                  marginTop: 8,
                  justifyContent: "center",
                }}
                onClick={openDebtModal}
              >
                <FiClock /> Dejar pendiente
              </button>
            )}
            {cart.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{
                  width: "100%",
                  marginTop: 8,
                  fontSize: 12,
                  justifyContent: "center",
                }}
                onClick={() => setCart([])}
              >
                <FiTrash2 /> Limpiar carrito
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={payModal}
        onClose={() => setPayModal(false)}
        onConfirm={confirmSale}
        processing={processing}
        total={total}
        items={cart}
      />

      {/* Debt Modal (dejar pendiente) */}
      <Modal
        open={debtModal}
        onClose={() => setDebtModal(false)}
        title="Dejar Pendiente"
        maxWidth={460}
      >
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text2)" }}>
              {cart.reduce((s, i) => s + i.quantity, 0)} artículos
            </span>
            <span
              style={{ fontWeight: 800, fontSize: 24, color: "var(--accent)" }}
            >
              {fmt(total)}
            </span>
          </div>
          {cart.map((i) => (
            <div
              key={i.product_id ?? i.combo_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
                color: "var(--text2)",
                marginBottom: 2,
              }}
            >
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{fmt(i.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="field">
          <label>Nombre del cliente *</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ej: Juan Pérez"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Teléfono (opcional)</label>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Ej: 8888-8888"
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setDebtModal(false)}>
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={confirmDebt}
            disabled={savingDebt}
          >
            {savingDebt ? "Guardando…" : <><FiClock /> Dejar Pendiente</>}
          </button>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={receiptModal}
        onClose={() => setReceiptModal(false)}
        title={
          <>
            <FiCheck /> Venta Exitosa
          </>
        }
        maxWidth={380}
      >
        {lastSale && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>
              <FiSmile />
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 28,
                color: "var(--green)",
                marginBottom: 4,
              }}
            >
              {fmt(lastSale.total)}
            </div>
            <div
              style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}
            >
              {lastSale.payment_method === "efectivo" ? (
                <>
                  <FiDollarSign /> Efectivo
                </>
              ) : (
                <>
                  <FiSmartphone /> SINPE
                </>
              )}
              {lastSale.change_given > 0 &&
                ` · Cambio: ${fmt(lastSale.change_given)}`}
            </div>

            {lastSale.sinpe_description && (
              <div
                style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
              >
                Ref: {lastSale.sinpe_description}
              </div>
            )}

            {lastSale.received_by && (
              <div
                style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}
              >
                Recibido por: <strong>{lastSale.received_by}</strong>
              </div>
            )}

            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 10,
                padding: "12px 16px",
                textAlign: "left",
                marginBottom: 20,
              }}
            >
              {(lastSale.items || []).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span>
                    {item.product_name} × {item.quantity}
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <button
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setReceiptModal(false)}
            >
              Nueva Venta
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
