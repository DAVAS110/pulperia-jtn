import React, { useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { Spinner, Modal, ConfirmDialog } from "../components/ui";
import { toast } from "../store/toastStore";
import useAuthStore from "../store/authStore";
import { fmtDateTime, timeAgo } from "../utils/helpers";

const EMPTY_FORM = { name: "", email: "", password: "", role: "employee" };

export default function Configuracion() {
  const { user, isAdmin } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'edit' | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, name, action: 'delete'|'toggle' }
  const [showPass, setShowPass] = useState(false);

  const load = async () => {
    if (!isAdmin()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.listUsers();
      setUsers(data.users);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowPass(false);
    setModal("create");
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setShowPass(false);
    setModal("edit");
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim())
      return toast.error("Nombre y email son requeridos");
    if (modal === "create" && !form.password)
      return toast.error("La contraseña es requerida");
    if (form.password && form.password.length < 6)
      return toast.error("La contraseña debe tener al menos 6 caracteres");

    setSaving(true);
    try {
      if (modal === "create") {
        await authAPI.createUser(form);
        toast.success(`Usuario "${form.name}" creado`);
      } else {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await authAPI.updateUser(editing.id, payload);
        toast.success("Usuario actualizado");
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    try {
      await authAPI.updateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? "Cuenta desactivada" : "Cuenta activada");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error");
    }
    setConfirm(null);
  };

  const deleteUser = async (id) => {
    try {
      const { data } = await authAPI.deleteUser(id);
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error al eliminar");
    }
    setConfirm(null);
  };

  const admins = users.filter((u) => u.role === "admin");
  const empleados = users.filter((u) => u.role === "employee");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Gestión de usuarios y ajustes del sistema</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* Mi perfil */}
        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            👤 Mi Perfil
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg,var(--accent),var(--accent2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
              <div style={{ color: "var(--text3)", fontSize: 13 }}>
                {user?.email}
              </div>
              <span
                className={`badge ${user?.role === "admin" ? "badge-blue" : "badge-green"}`}
                style={{ marginTop: 6 }}
              >
                {user?.role === "admin" ? "🔑 Administrador" : "👷 Empleado"}
              </span>
            </div>
          </div>
        </div>

        {/* App info */}
        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            🏪 Acerca de Pulperia JTN
          </div>
          {[
            ["Versión", "1.0.0"],
            ["Stack", "React + Node.js + PostgreSQL"],
            ["Deploy", "Vercel + Render + Supabase"],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text3)", fontWeight: 500 }}>
                {k}
              </span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users section - admin only */}
      {isAdmin() && (
        <>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>
                👥 Gestión de Usuarios
              </div>
              <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>
                {users.length} usuarios · {admins.length} admin ·{" "}
                {empleados.length} empleados
              </p>
            </div>
            <button className="btn btn-accent" onClick={openCreate}>
              + Nuevo Usuario
            </button>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Último acceso</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background:
                                  u.role === "admin"
                                    ? "linear-gradient(135deg,var(--accent),var(--accent2))"
                                    : "linear-gradient(135deg,var(--blue),#3b82f6)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "white",
                                flexShrink: 0,
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                {u.name}
                              </div>
                              {u.id === user.id && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--accent)",
                                    fontWeight: 600,
                                  }}
                                >
                                  Tú
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text2)" }}>
                          {u.email}
                        </td>
                        <td>
                          <span
                            className={`badge ${u.role === "admin" ? "badge-blue" : "badge-green"}`}
                          >
                            {u.role === "admin" ? "🔑 Admin" : "👷 Empleado"}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--text3)" }}>
                          {u.last_login ? timeAgo(u.last_login) : "Nunca"}
                        </td>
                        <td>
                          <span
                            className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}
                          >
                            {u.is_active ? "● Activo" : "○ Inactivo"}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text3)" }}>
                          {fmtDateTime(u.created_at)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button
                              className="btn-icon"
                              onClick={() => openEdit(u)}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            {u.id !== user.id && (
                              <>
                                <button
                                  className="btn-icon"
                                  title={u.is_active ? "Desactivar" : "Activar"}
                                  onClick={() =>
                                    setConfirm({ user: u, action: "toggle" })
                                  }
                                >
                                  {u.is_active ? "🔒" : "🔓"}
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Eliminar permanentemente"
                                  onClick={() =>
                                    setConfirm({ user: u, action: "delete" })
                                  }
                                  style={{ color: "var(--red)" }}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal === "create" ? "+ Nuevo Usuario" : `Editar — ${editing?.name}`
        }
        maxWidth={460}
      >
        <div className="form-row">
          <div className="field" style={{ gridColumn: "1/-1" }}>
            <label>Nombre completo *</label>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="Juan Pérez"
            />
          </div>
        </div>
        <div className="field">
          <label>Correo electrónico *</label>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="juan@pulperia.com"
            disabled={modal === "edit"}
            style={
              modal === "edit" ? { opacity: 0.6, cursor: "not-allowed" } : {}
            }
          />
          {modal === "edit" && (
            <div
              style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 4 }}
            >
              El email no se puede cambiar
            </div>
          )}
        </div>
        <div className="form-row">
          <div className="field">
            <label>
              {modal === "create"
                ? "Contraseña *"
                : "Nueva contraseña (opcional)"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder={
                  modal === "create"
                    ? "Mínimo 6 caracteres"
                    : "Dejar vacío para no cambiar"
                }
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  color: "var(--text3)",
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div className="field">
            <label>Rol</label>
            <select
              value={form.role}
              onChange={set("role")}
              disabled={modal === "edit" && editing?.id === user.id}
            >
              <option value="employee">👷 Empleado</option>
              <option value="admin">🔑 Administrador</option>
            </select>
          </div>
        </div>

        {/* Role info box */}
        <div
          style={{
            background:
              form.role === "admin"
                ? "var(--blue-light)"
                : "var(--green-light)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12.5,
            color: form.role === "admin" ? "var(--blue)" : "var(--green)",
            marginBottom: 4,
          }}
        >
          {form.role === "admin"
            ? "🔑 Acceso completo: ventas, inventario, reportes, usuarios y tesorería."
            : "👷 Acceso a ventas, inventario y reportes. Sin acceso a usuarios ni retiros."}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(null)}>
            Cancelar
          </button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>
            {saving
              ? "Guardando…"
              : modal === "create"
                ? "+ Crear Usuario"
                : "💾 Guardar Cambios"}
          </button>
        </div>
      </Modal>

      {/* Confirm toggle / delete */}
      {confirm?.action === "toggle" && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={
            confirm.user.is_active
              ? "🔒 Desactivar cuenta"
              : "🔓 Activar cuenta"
          }
          maxWidth={400}
        >
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20 }}>
            {confirm.user.is_active
              ? `¿Desactivar la cuenta de "${confirm.user.name}"? No podrá iniciar sesión hasta que la reactives.`
              : `¿Activar la cuenta de "${confirm.user.name}"? Podrá volver a iniciar sesión.`}
          </p>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              className={`btn ${confirm.user.is_active ? "btn-danger" : "btn-green"}`}
              onClick={() => toggleStatus(confirm.user)}
            >
              {confirm.user.is_active ? "🔒 Desactivar" : "🔓 Activar"}
            </button>
          </div>
        </Modal>
      )}

      {confirm?.action === "delete" && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title="🗑️ Eliminar Usuario"
          maxWidth={400}
        >
          <div
            style={{
              background: "var(--red-light)",
              border: "1px solid #f5c6c3",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            ⚠️ Esta acción es <strong>permanente</strong> e irreversible.
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20 }}>
            ¿Eliminar definitivamente la cuenta de{" "}
            <strong>"{confirm.user.name}"</strong>? Sus ventas y movimientos de
            inventario se conservarán.
          </p>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => deleteUser(confirm.user.id)}
            >
              🗑️ Eliminar permanentemente
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
