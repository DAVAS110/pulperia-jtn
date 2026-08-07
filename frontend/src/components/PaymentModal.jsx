import React, { useState, useEffect, useRef } from "react";
import { Modal } from "./ui";
import { toast } from "../store/toastStore";
import { fmt } from "../utils/helpers";
import { compressImage, formatBytes, base64Size } from "../utils/imageUtils";
import {
  FiDollarSign,
  FiSmartphone,
  FiCamera,
  FiImage,
  FiX,
  FiDownload,
  FiCheckCircle,
} from "react-icons/fi";

// Modal de cobro reutilizable (efectivo/sinpe + foto de comprobante).
// Usado tanto por Caja (cobro inmediato) como por Pendientes (cobro de deudas).
export default function PaymentModal({
  open,
  onClose,
  onConfirm,
  processing,
  total,
  items,
  title = "Confirmar Pago",
  confirmLabel = (
    <>
      <FiCheckCircle /> Confirmar Venta
    </>
  ),
}) {
  const [payMethod, setPayMethod] = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [sinpeDescription, setSinpeDescription] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [sinpePhoto, setSinpePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [viewPhotoModal, setViewPhotoModal] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPayMethod("efectivo");
    setCashReceived("");
    setSinpeDescription("");
    setReceivedBy("");
    setSinpePhoto(null);
    setPhotoPreview(null);
  }, [open]);

  const change =
    payMethod === "efectivo" && cashReceived
      ? parseFloat(cashReceived) - total
      : 0;

  const handlePhotoFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede superar 10MB");
      return;
    }
    try {
      toast.info && toast.info("Comprimiendo imagen...");
      const compressed = await compressImage(file, {
        maxWidth: 1000,
        quality: 0.7,
      });
      const originalSize = formatBytes(file.size);
      const compressedSize = formatBytes(base64Size(compressed));
      setSinpePhoto(compressed);
      setPhotoPreview(compressed);
      toast.success(`Imagen lista (${originalSize} → ${compressedSize})`);
    } catch {
      toast.error("Error al procesar la imagen");
    }
    e.target.value = "";
  };

  const removePhoto = () => {
    setSinpePhoto(null);
    setPhotoPreview(null);
  };

  const handleConfirm = () => {
    if (payMethod === "efectivo" && cashReceived && parseFloat(cashReceived) < total)
      return toast.error("Efectivo insuficiente");
    if (payMethod === "sinpe" && !receivedBy.trim())
      return toast.error("Indica quién recibió el SINPE");
    onConfirm({
      payment_method: payMethod,
      cash_received:
        payMethod === "efectivo" && cashReceived ? parseFloat(cashReceived) : null,
      sinpe_description: payMethod === "sinpe" ? sinpeDescription : null,
      sinpe_photo: payMethod === "sinpe" ? sinpePhoto : null,
      received_by: receivedBy.trim() || null,
    });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} maxWidth={460}>
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
              marginBottom: items?.length ? 8 : 0,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text2)" }}>
              {items?.length
                ? `${items.reduce((s, i) => s + i.quantity, 0)} artículos`
                : "Total a cobrar"}
            </span>
            <span
              style={{ fontWeight: 800, fontSize: 24, color: "var(--accent)" }}
            >
              {fmt(total)}
            </span>
          </div>
          {(items || []).map((i, idx) => (
            <div
              key={idx}
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
          <label>Método de Pago</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["efectivo", "sinpe"].map((m) => (
              <button
                key={m}
                className={`btn ${payMethod === m ? "btn-accent" : "btn-ghost"}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  setPayMethod(m);
                  setCashReceived("");
                  setSinpeDescription("");
                  setReceivedBy("");
                  removePhoto();
                }}
              >
                {m === "efectivo" ? (
                  <>
                    <FiDollarSign /> Efectivo
                  </>
                ) : (
                  <>
                    <FiSmartphone /> SINPE
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {payMethod === "efectivo" && (
          <>
            <div className="field">
              <label>Efectivo Recibido (₡)</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={total.toString()}
                min={total}
                step="100"
              />
            </div>
            {cashReceived && parseFloat(cashReceived) >= total && (
              <div
                style={{
                  background: "var(--green-light)",
                  border: "1px solid var(--green)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--green)",
                    fontWeight: 600,
                  }}
                >
                  CAMBIO
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 26,
                    color: "var(--green)",
                  }}
                >
                  {fmt(change)}
                </div>
              </div>
            )}
          </>
        )}

        {payMethod === "sinpe" && (
          <>
            <div className="field">
              <label>Descripción / Referencia SINPE</label>
              <input
                type="text"
                value={sinpeDescription}
                onChange={(e) => setSinpeDescription(e.target.value)}
                placeholder="Ej: SINPE #123456, Juan Pérez…"
              />
            </div>
            <div className="field">
              <label>
                <FiCamera /> Foto del comprobante (opcional)
              </label>
              {photoPreview ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={photoPreview}
                    alt="Comprobante"
                    onClick={() => setViewPhotoModal(photoPreview)}
                    style={{
                      width: "100%",
                      maxHeight: 200,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "2px solid var(--border)",
                      cursor: "pointer",
                      display: "block",
                    }}
                  />
                  <button
                    onClick={removePhoto}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "var(--red)",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FiX />
                  </button>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text3)",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Toca para ampliar · Toca <FiX /> para quitar
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <FiCamera /> Cámara
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FiImage /> Galería
                  </button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={handlePhotoFile}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handlePhotoFile}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <div className="field">
          <label>
            {payMethod === "sinpe"
              ? "¿Quién recibió el SINPE? *"
              : "¿Quién recibió el pago? (opcional)"}
          </label>
          <input
            type="text"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            placeholder="Ej: María, Carlos…"
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={handleConfirm}
            disabled={processing}
          >
            {processing ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </Modal>

      {/* Foto en pantalla completa */}
      <Modal
        open={!!viewPhotoModal}
        onClose={() => setViewPhotoModal(null)}
        title={
          <>
            <FiCamera /> Comprobante SINPE
          </>
        }
        maxWidth={640}
      >
        {viewPhotoModal && (
          <>
            <img
              src={viewPhotoModal}
              alt="Comprobante"
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--border)",
                display: "block",
              }}
            />
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <a
                href={viewPhotoModal}
                download="comprobante-sinpe.jpg"
                className="btn btn-ghost"
              >
                <FiDownload /> Descargar
              </a>
              <button
                className="btn btn-accent"
                onClick={() => setViewPhotoModal(null)}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
