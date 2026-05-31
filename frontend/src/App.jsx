import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useOnlineQueueFlusher } from './hooks/useOfflineQueue.jsx';
import IntroPage from './pages/IntroPage.jsx';
import VisitorPage from './pages/VisitorPage.jsx';
import ThankYouPage from './pages/ThankYouPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminQrPage from './pages/AdminQrPage.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';

const VISITOR_PATHS = ['/', '/register', '/thank-you'];

function AppFooter() {
  const path = useLocation().pathname;
  if (VISITOR_PATHS.includes(path) || path.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-cz-line bg-white py-6 text-center text-sm text-cz-muted">
      <Link className="underline decoration-slate-300 underline-offset-4 hover:text-cz-ink" to="/register">
        Visitor form
      </Link>
    </footer>
  );
}

export default function App() {
  useOnlineQueueFlusher();
  const path = useLocation().pathname;
  const isAdminLogin = path === '/admin/login';
  const isAdminDashboard = path === '/admin';
  const isAdminQr = path === '/admin/qr';
  const isBlackVisitor = path === '/' || path === '/thank-you' || isAdminQr;

  return (
    <div
      className={
        isAdminLogin
          ? 'min-h-full bg-black text-white'
          : isAdminDashboard
            ? 'min-h-full bg-cz-admin-bg text-cz-admin-ink'
            : isBlackVisitor
              ? 'min-h-full bg-black text-white'
              : 'min-h-full bg-cz-dark-bg text-cz-dark-ink'
      }
    >
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/register" element={<VisitorPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/qr"
          element={
            <RequireAdmin>
              <AdminQrPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AppFooter />
    </div>
  );
}
