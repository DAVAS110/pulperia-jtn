import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { toast } from "../store/toastStore";

export default function AuthPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    const r = await login(form.email, form.password);
    if (r.success) {
      toast.success("¡Bienvenido!");
      navigate("/");
    } else toast.error(r.error);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="icon">🏪</div>
          <h1>Pulperia JTN</h1>
          <p>Sistema de Gestión de Inventario</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="usuario@pulperia.com"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "var(--text3)",
                  padding: 0,
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-accent"
            style={{
              width: "100%",
              padding: "13px",
              marginTop: 8,
              justifyContent: "center",
              fontSize: 15,
            }}
            disabled={loading}
          >
            {loading ? "Ingresando…" : "Iniciar sesión →"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12.5,
            color: "var(--text3)",
          }}
        >
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </p>
      </div>
    </div>
  );
}
