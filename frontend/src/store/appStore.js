import { create } from "zustand";
import { categoriesAPI, productsAPI, reportsAPI } from "../services/api";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const useAppStore = create((set, get) => ({
  // ─── Categorías ───────────────────────────────────────────
  categories: [],
  categoriesLoaded: 0,

  fetchCategories: async (force = false) => {
    const { categories, categoriesLoaded } = get();
    const stale = Date.now() - categoriesLoaded > CACHE_TTL;
    if (!force && categories.length && !stale) return categories;
    try {
      const { data } = await categoriesAPI.list();
      set({ categories: data.categories, categoriesLoaded: Date.now() });
      return data.categories;
    } catch {
      return get().categories;
    }
  },

  addCategory: (cat) => set((s) => ({ categories: [...s.categories, cat] })),
  updateCategory: (cat) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === cat.id ? cat : c)),
    })),
  removeCategory: (id) =>
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

  // ─── Dashboard stats ──────────────────────────────────────
  dashboardData: null,
  dashboardLoaded: 0,

  fetchDashboard: async (force = false) => {
    const { dashboardData, dashboardLoaded } = get();
    const stale = Date.now() - dashboardLoaded > 60 * 1000; // 1 min cache
    if (!force && dashboardData && !stale) return dashboardData;
    try {
      const { data } = await reportsAPI.dashboard();
      set({ dashboardData: data, dashboardLoaded: Date.now() });
      return data;
    } catch {
      return get().dashboardData;
    }
  },

  invalidateDashboard: () => set({ dashboardLoaded: 0 }),

  // ─── Low stock count (para el badge del sidebar) ──────────
  lowStockCount: 0,
  setLowStockCount: (n) => set({ lowStockCount: n }),
}));

export default useAppStore;
