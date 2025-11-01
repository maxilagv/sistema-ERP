import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LoginPage from '../pages/Login';
import AdminLayout from '../layout/Layout';
import Dashboard from '../pages/Dashboard';
import Clientes from '../pages/Clientes';
import Productos from '../pages/Productos';
import Categorias from '../pages/Categorias';
import Stock from '../pages/Stock';
import Finanzas from '../pages/Finanzas';
import Configuracion from '../pages/Configuracion';
import { useAuth } from '../context/AuthContext';

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null; // or a loader
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <Protected>
              <AdminLayout />
            </Protected>
          }
        >
          <Route index element={<Page><Dashboard /></Page>} />
          <Route path="dashboard" element={<Page><Dashboard /></Page>} />
          <Route path="clientes" element={<Page><Clientes /></Page>} />
          <Route path="productos" element={<Page><Productos /></Page>} />
          <Route path="categorias" element={<Page><Categorias /></Page>} />
          <Route path="stock" element={<Page><Stock /></Page>} />
          <Route path="finanzas" element={<Page><Finanzas /></Page>} />
          <Route path="configuracion" element={<Page><Configuracion /></Page>} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function Page({ children }: { children: JSX.Element }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
