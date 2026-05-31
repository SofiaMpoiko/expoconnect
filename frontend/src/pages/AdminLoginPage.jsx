import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getAdminToken, setAdminToken } from '../adminAuth.js';
import BrandLogo from '../components/BrandLogo.jsx';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    api
      .get('/admin/session')
      .then(() => navigate('/admin', { replace: true }))
      .catch(() => {});
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/admin/login', { password });
      setAdminToken(res.data.token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`intro-page relative flex min-h-dvh flex-col overflow-x-hidden bg-black pb-[env(safe-area-inset-bottom)] ${animate ? 'intro-page--animate' : ''}`}
    >
      <div className="intro-top relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-5 pt-10 text-center sm:max-w-xl sm:px-6 sm:pt-12">
        <BrandLogo />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:max-w-xl sm:px-6">
        <h1 className="intro-headline static bottom-auto left-auto right-auto mx-auto -mt-12 mb-6 w-full max-w-lg translate-y-0 sm:-mt-14 sm:max-w-xl">
          <span className="intro-line block text-2xl font-bold leading-none tracking-tight text-white sm:text-3xl">
            ExpoConnect
          </span>
        </h1>

        <p className="intro-sub mb-12 mt-0 max-w-none whitespace-nowrap px-1 text-lg leading-none text-zinc-400 sm:text-xl">
          Collect visitor information, requests, and follow-up opportunities in one place.
        </p>

        <form onSubmit={onSubmit} className="admin-login-form mt-0 w-full max-w-xs space-y-5">
          <label className="block text-left">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Password</span>
            <input
              className="input-dark w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={busy || !password}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-0 bg-[#EE412F] px-8 py-4 text-[15px] font-semibold uppercase tracking-wide text-white shadow-[0_10px_15px_-3px_rgb(238_65_47/0.25)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <div className="intro-footer-tags relative z-10 mt-auto flex items-end justify-between gap-4 px-5 pb-6 pt-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500 sm:px-6 sm:pb-8 sm:text-[10px]">
        <span className="intro-tag shrink-0 text-zinc-500">
          #carbonzapp<span className="text-[#EE412F]">X</span>series
        </span>
        <span className="intro-tag shrink-0 font-semibold text-[#EE412F]">Innovation driven</span>
      </div>
    </div>
  );
}
