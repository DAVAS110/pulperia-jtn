import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useAuthStore from "./store/authStore";
import { ToastContainer, Spinner } from "./components/ui";
import AppLayout from "./components/layout/AppLayout";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import { useKeepAlive } from "./hooks/useKeepAlive";
import { InstallBanner, UpdatePrompt } from "./components/PWAComponents";

// Rutas menos visitadas: se descargan solo cuando se navega a ellas,
// en vez de sumarse al bundle inicial que carga todo el mundo.
const Productos = lazy(() => import("./pages/Productos"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Movimientos = lazy(() => import("./pages/Movimientos"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Caja = lazy(() => import("./pages/Caja"));
const Ventas = lazy(() => import("./pages/Ventas"));
const QRPage = lazy(() => import("./pages/QRPage"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Combos = lazy(() => import("./pages/Combos"));
const Pendientes = lazy(() => import("./pages/Pendientes"));
const Tesoreria = lazy(() => import("./pages/Tesoreria"));
const Horarios = lazy(() => import("./pages/Horarios"));

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuthStore();
  return isAdmin() ? children : <Navigate to="/" replace />;
}

function AppWithKeepAlive({ children }) {
  useKeepAlive(); // Mantiene el backend despierto
  return children;
}

function App() {
  const { user, validateSession } = useAuthStore();

  React.useEffect(() => {
    validateSession();
  }, [validateSession]);

  return (
    <BrowserRouter>
      <AppWithKeepAlive>
        {/* Componentes PWA */}
        <InstallBanner />
        <UpdatePrompt />

        <ToastContainer />
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <AuthPage />}
          />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Suspense fallback={<Spinner />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/productos" element={<Productos />} />
                      <Route path="/categorias" element={<Categorias />} />
                      <Route path="/movimientos" element={<Movimientos />} />
                      <Route path="/alertas" element={<Alertas />} />
                      <Route path="/caja" element={<Caja />} />
                      <Route path="/ventas" element={<Ventas />} />
                      <Route path="/qr" element={<QRPage />} />
                      <Route
                        path="/configuracion"
                        element={
                          <AdminRoute>
                            <Configuracion />
                          </AdminRoute>
                        }
                      />
                      <Route path="/combos" element={<Combos />} />
                      <Route path="/pendientes" element={<Pendientes />} />
                      <Route path="/horarios" element={<Horarios />} />
                      <Route
                        path="/tesoreria"
                        element={
                          <AdminRoute>
                            <Tesoreria />
                          </AdminRoute>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </AppLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </AppWithKeepAlive>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
