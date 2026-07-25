import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useAuthStore from "./store/authStore";
import { ToastContainer } from "./components/ui";
import AppLayout from "./components/layout/AppLayout";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Categorias from "./pages/Categorias";
import Movimientos from "./pages/Movimientos";
import Alertas from "./pages/Alertas";
import Caja from "./pages/Caja";
import Ventas from "./pages/Ventas";
import QRPage from "./pages/QRPage";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";
import Combos from "./pages/Combos";
import Pendientes from "./pages/Pendientes";
import { useKeepAlive } from "./hooks/useKeepAlive";
import { InstallBanner, UpdatePrompt } from "./components/PWAComponents";

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/login" replace />;
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
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/categorias" element={<Categorias />} />
                    <Route path="/movimientos" element={<Movimientos />} />
                    <Route path="/alertas" element={<Alertas />} />
                    <Route path="/caja" element={<Caja />} />
                    <Route path="/ventas" element={<Ventas />} />
                    <Route path="/qr" element={<QRPage />} />
                    <Route path="/reportes" element={<Reportes />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/combos" element={<Combos />} />
                    <Route path="/pendientes" element={<Pendientes />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
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
