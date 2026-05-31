import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { clearAdminToken, getAdminToken } from '../adminAuth.js';

export default function RequireAdmin({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setStatus('guest');
      return;
    }

    api
      .get('/admin/session')
      .then(() => setStatus('authed'))
      .catch(() => {
        clearAdminToken();
        setStatus('guest');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cz-admin-bg text-cz-admin-muted">
        Loading…
      </div>
    );
  }

  if (status === 'guest') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
