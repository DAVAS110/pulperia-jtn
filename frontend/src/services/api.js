import axios from "axios";

const api = axios.create({
  // Siempre relativo al propio dominio: en dev lo resuelve el proxy de Vite
  // (vite.config.js), en producción el rewrite de Vercel (vercel.json).
  // Esto evita que la cookie de sesión sea "cross-site" para el navegador
  // (Safari/iOS bloquea cookies de terceros por default).
  baseURL: "/api",
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  listUsers: () => api.get("/auth/users"),
  createUser: (data) => api.post("/auth/users", data),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

export const categoriesAPI = {
  list: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const productsAPI = {
  list: (params) => api.get("/products", { params }),
  getOne: (id) => api.get(`/products/${id}`),
  getBySku: (sku) => api.get(`/products/sku/${sku}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

export const inventoryAPI = {
  list: (params) => api.get("/inventory", { params }),
  create: (data) => api.post("/inventory", data),
};

export const salesAPI = {
  list: (params) => api.get("/sales", { params }),
  create: (data) => api.post("/sales", data),
  cancel: (id) => api.delete(`/sales/${id}`),
};

export const reportsAPI = {
  dashboard: () => api.get("/reports/dashboard"),
  daily: (params) => api.get("/reports/daily", { params }),
  sendEmail: (data) => api.post("/reports/send-email", data),
};

export const combosAPI = {
  list: () => api.get("/combos"),
  listAll: (params) => api.get("/combos/all", { params }),
  create: (data) => api.post("/combos", data),
  update: (id, data) => api.put(`/combos/${id}`, data),
  delete: (id) => api.delete(`/combos/${id}`),
};

export const debtsAPI = {
  list: (params) => api.get("/debts", { params }),
  pay: (id, data) => api.post(`/debts/${id}/pay`, data),
};

export const shiftsAPI = {
  list: (params) => api.get("/shifts", { params }),
  summary: (params) => api.get("/shifts/summary", { params }),
  create: (data) => api.post("/shifts", data),
  update: (id, data) => api.put(`/shifts/${id}`, data),
  delete: (id) => api.delete(`/shifts/${id}`),
};

export const treasuryAPI = {
  getSummary: () => api.get("/treasury"),
  listMovements: (params) => api.get("/treasury/movements", { params }),
  withdraw: (data) => api.post("/treasury/withdraw", data),
  deposit: (data) => api.post("/treasury/deposit", data),
};

export default api;
