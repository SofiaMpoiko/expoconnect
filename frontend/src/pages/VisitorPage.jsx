import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getAdminToken } from '../adminAuth.js';
import { BUSINESS_TYPES, PRODUCTS } from '../constants.js';
import { enqueueOfflineLead, isLikelyNetworkError } from '../offlineQueue.js';
import { OfflineBanner } from '../hooks/useOfflineQueue.jsx';
import BrandLogo from '../components/BrandLogo.jsx';

const initial = {
  full_name: '',
  company: '',
  country: '',
  email: '',
  business_type: '',
  notes: '',
  consent: false,
};

export default function VisitorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [products, setProducts] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    return form.full_name.trim() && form.company.trim() && form.email.trim() && form.consent;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Please complete all required fields and confirm consent.');
      return;
    }

    if (photo && !navigator.onLine) {
      setError(
        'Photo uploads require an internet connection. Remove the photo or reconnect and try again.'
      );
      return;
    }

    const basePayload = {
      full_name: form.full_name.trim(),
      company: form.company.trim(),
      country: form.country.trim(),
      email: form.email.trim(),
      business_type: form.business_type,
      interested_products: products,
      notes: form.notes.trim(),
      consent: true,
    };

    setBusy(true);
    try {
      if (photo) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(basePayload)) {
          if (k === 'interested_products') fd.append(k, JSON.stringify(v));
          else fd.append(k, String(v));
        }
        fd.append('photo', photo);
        // Let axios set Content-Type with the correct multipart boundary.
        await api.post('/leads', fd);
      } else {
        await api.post('/leads', basePayload, { headers: { 'Content-Type': 'application/json' } });
      }

      navigate('/thank-you', { replace: true });
    } catch (err) {
      if (!photo && isLikelyNetworkError(err)) {
        enqueueOfflineLead(basePayload);
        navigate('/thank-you', { replace: true, state: { offline: true } });
      } else {
        const msg = err?.response?.data?.error || err?.message || 'Submission failed.';
        setError(String(msg));
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleProduct(p) {
    setProducts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      {getAdminToken() ? (
        <Link
          to="/admin"
          className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-300 backdrop-blur-sm hover:border-zinc-500 hover:text-white sm:left-6"
        >
          Dashboard
        </Link>
      ) : null}

      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-10 sm:max-w-xl sm:px-6 sm:pt-12">
      <OfflineBanner variant="dark" />

      <header className="mb-8 flex flex-col items-center text-center">
        <BrandLogo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-cz-dark-ink">Let&apos;s connect</h1>
        <p className="mt-3 text-base text-cz-dark-muted">
          Share your contact details to receive personalized product information and follow-up.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-3xl border border-cz-dark-line bg-cz-dark-surface p-5 shadow-lg shadow-black/30"
      >
        <Field label="Full name" required>
          <input
            className="input-dark"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            autoComplete="name"
            inputMode="text"
          />
        </Field>

        <Field label="Company name" required>
          <input
            className="input-dark"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            autoComplete="organization"
          />
        </Field>

        <Field label="Email" required>
          <input
            className="input-dark"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            inputMode="email"
          />
        </Field>

        <Field label="Business type">
          <select
            className={`input-dark${!form.business_type ? ' select-placeholder' : ''}`}
            value={form.business_type}
            onChange={(e) => setForm({ ...form, business_type: e.target.value })}
          >
            <option value="" className="italic text-zinc-500">
              Select
            </option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Country">
          <input
            className="input-dark"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            autoComplete="country-name"
          />
        </Field>

        <div>
          <div className="mb-2 text-sm font-medium text-cz-dark-ink">Interested products</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRODUCTS.map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cz-dark-line bg-cz-dark-elevated px-4 py-3 transition-colors has-[:checked]:border-cz-red/60 has-[:checked]:bg-cz-red/10"
              >
                <input
                  type="checkbox"
                  checked={products.includes(p)}
                  onChange={() => toggleProduct(p)}
                  className="h-5 w-5 accent-cz-red"
                />
                <span className={`text-sm text-cz-dark-ink${p === 'OTHER' ? ' italic' : ''}`}>{p}</span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Notes">
          <textarea
            className="input-dark min-h-[110px] resize-y"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <Field label="Photo (optional)">
          <input
            className="cz-file-input block w-full text-sm text-cz-dark-muted"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
          <p className="mt-2 text-xs text-cz-dark-muted">JPG, PNG, WEBP, or GIF. Max 6 MB.</p>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cz-dark-line bg-cz-dark-elevated px-4 py-4 has-[:checked]:border-cz-red/60">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-cz-red"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          <span className="text-sm leading-relaxed text-cz-dark-ink">
            I agree to receive communication from Carbon Zapp
          </span>
        </label>

        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="cz-btn-red w-full rounded-2xl border-0 px-4 py-4 text-base font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>

        <p className="text-center text-xs text-cz-dark-muted">Need help? Ask a Carbon Zapp team member at the stand.</p>
      </form>

      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-cz-dark-ink">
        {label}
        {required ? <span className="text-cz-red"> *</span> : null}
      </div>
      {children}
    </label>
  );
}
