import { create } from "zustand";
import { authAPI } from "../services/api";

const useAuthStore = create((set, get) => ({
  user: null, // 🔐 NO USAR localStorage - cookies httpOnly manejan persistencia
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authAPI.login({ email, password });
      // Cookie de autenticación se establece automáticamente en respuesta
      set({ user: data.user, loading: false });
      return { success: true };
    } catch (err) {
      const error = err.response?.data?.error || "Error al iniciar sesión";
      set({ loading: false, error });
      return { success: false, error };
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
      // Cookie se limpia automáticamente en backend
    } catch {
      // ignore logout failure
    }
    localStorage.removeItem("cart"); // no dejar el carrito de la sesión anterior visible
    set({ user: null });
  },

  validateSession: async () => {
    try {
      const { data } = await authAPI.me();
      // Cookie válida = servidor responde con datos
      set({ user: data.user });
    } catch {
      // Cookie inválida/expirada = servidor responde 401
      set({ user: null });
    }
  },

  isAdmin: () => get().user?.role === "admin",
}));

export default useAuthStore;
