import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { clearAdminToken, getAdminToken } from '../adminAuth.js';
import { BUSINESS_TYPES, EXPORT_COLUMNS, PRODUCTS } from '../constants.js';
import { OfflineBanner } from '../hooks/useOfflineQueue.jsx';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '';
  }
}

function LeadCard({ lead, onEdit, onDelete, onViewPhoto }) {
  const products = (lead.interested_products || []).join(', ');

  return (
    <article className="rounded-2xl border border-cz-admin-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-cz-admin-muted">{formatWhen(lead.created_at)}</div>
          <div className="mt-1 truncate text-base font-semibold text-cz-admin-ink">{lead.full_name}</div>
          <div className="truncate text-sm text-cz-admin-muted">{lead.company}</div>
        </div>
        {lead.photo_path ? (
          <button
            type="button"
            className="shrink-0 rounded-xl border border-cz-admin-line px-3 py-2 text-xs font-semibold text-cz-accent"
            onClick={() => onViewPhoto(lead.photo_path)}
          >
            Photo
          </button>
        ) : null}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {lead.country ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-semibold text-cz-admin-muted">Country</dt>
            <dd className="min-w-0 break-words">{lead.country}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-cz-admin-muted">Email</dt>
          <dd className="min-w-0 break-all">
            <a href={`mailto:${lead.email}`} className="text-cz-accent underline">
              {lead.email}
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-cz-admin-muted">Type</dt>
          <dd className="min-w-0 break-words">{lead.business_type}</dd>
        </div>
        {products ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-semibold text-cz-admin-muted">Products</dt>
            <dd className="min-w-0 break-words">{products}</dd>
          </div>
        ) : null}
        {lead.notes ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-semibold text-cz-admin-muted">Notes</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-cz-admin-muted line-clamp-4">{lead.notes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex gap-2 border-t border-cz-admin-line pt-3">
        <button
          type="button"
          className="min-h-[44px] flex-1 rounded-2xl border border-cz-admin-line px-3 py-2.5 text-sm font-semibold text-cz-accent"
          onClick={() => onEdit(lead)}
        >
          Edit
        </button>
        <button
          type="button"
          className="min-h-[44px] flex-1 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700"
          onClick={() => onDelete(lead)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [businessType, setBusinessType] = useState('');
  const [product, setProduct] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (debouncedSearch) q.set('search', debouncedSearch);
    if (businessType) q.set('business_type', businessType);
    if (product) q.set('product', product);
    if (dateFrom) q.set('date_from', dateFrom);
    if (dateTo) q.set('date_to', dateTo);
    return q.toString();
  }, [debouncedSearch, businessType, product, dateFrom, dateTo]);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      if (!silent) setError('');
      try {
        const q = new URLSearchParams(query);
        q.set('_', String(Date.now()));
        const res = await api.get(`/leads?${q.toString()}`, {
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        setLeads(res.data.leads || []);
      } catch (e) {
        if (!silent) {
          setError(e?.response?.data?.error || e?.message || 'Failed to load leads.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return undefined;

    let es;
    let reconnectTimer;

    const connect = () => {
      const url = `/api/leads/events?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.addEventListener('leads-changed', () => {
        if (document.visibilityState === 'visible') {
          refresh({ silent: true }).catch(() => {});
        }
      });

      es.onopen = () => {
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
        }
      };

      es.onerror = () => {
        es?.close();
        es = undefined;
        if (!reconnectTimer) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = undefined;
            connect();
          }, 3000);
        }
      };
    };

    connect();

    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      refresh({ silent: true }).catch(() => {});
    };

    const backupPollId = window.setInterval(poll, 30_000);
    window.addEventListener('focus', poll);
    window.addEventListener('online', poll);
    document.addEventListener('visibilitychange', poll);

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      es?.close();
      window.clearInterval(backupPollId);
      window.removeEventListener('focus', poll);
      window.removeEventListener('online', poll);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh]);

  const filtersPayload = useMemo(
    () => ({
      search: debouncedSearch,
      business_type: businessType,
      product,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    [debouncedSearch, businessType, product, dateFrom, dateTo]
  );

  async function logout() {
    try {
      await api.post('/admin/logout');
    } catch {
      // still sign out locally
    }
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  }

  async function downloadExport() {
    if (exportBusy) return;
    setExportBusy(true);
    setError('');
    try {
      const res = await api.post(
        '/export',
        { columns: EXPORT_COLUMNS, filters: filtersPayload },
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carbon-zapp-leads.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-cz-admin-bg">
      <OfflineBanner />

      <header className="border-b border-cz-admin-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <img
            src="/carbon-zapp-logo.png"
            srcSet="/carbon-zapp-logo.png 1x, /carbon-zapp-logo@2x.png 2x"
            width={328}
            height={68}
            alt="Carbon Zapp"
            className="h-9 w-auto max-w-[min(100%,220px)] sm:h-10"
            decoding="async"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Link
              className="flex min-h-[44px] items-center justify-center rounded-2xl bg-[#EE412F] px-3 py-2.5 text-center text-sm font-semibold text-white shadow-[0_10px_15px_-3px_rgb(238_65_47/0.25)] hover:opacity-95 sm:px-4 sm:py-3"
              to="/admin/qr"
            >
              QR
            </Link>
            <Link
              className="flex min-h-[44px] items-center justify-center rounded-2xl border border-cz-admin-line bg-white px-3 py-2.5 text-center text-sm font-semibold text-cz-admin-ink sm:px-4 sm:py-3"
              to="/register"
            >
              Visitor form
            </Link>
            <button
              type="button"
              className="min-h-[44px] rounded-2xl bg-zinc-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 sm:px-4 sm:py-3"
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? 'Close' : 'Add lead'}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-2xl border border-cz-admin-line bg-cz-admin-elevated px-3 py-2.5 text-sm font-semibold text-cz-admin-ink hover:bg-white disabled:opacity-50 sm:px-4 sm:py-3"
              disabled={exportBusy}
              onClick={() => downloadExport().catch(() => {})}
            >
              {exportBusy ? 'Exporting…' : 'Export Data'}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-2xl border border-cz-admin-line bg-white px-3 py-2.5 text-sm font-semibold text-cz-admin-muted hover:bg-cz-admin-elevated hover:text-cz-admin-ink sm:px-4 sm:py-3"
              onClick={() => logout().catch(() => {})}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-4 pt-5 sm:pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-cz-admin-ink sm:text-2xl">Lead Dashboard</h1>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {showAdd ? (
          <div className="mb-6">
            <LeadEditor
              title="Manual lead entry"
              onClose={() => setShowAdd(false)}
              onSaved={() => {
                setShowAdd(false);
                refresh().catch(() => {});
              }}
            />
          </div>
        ) : null}

        <div className="mb-4 space-y-3">
          <div className="w-full">
            <label className="block text-xs font-semibold text-cz-admin-muted">Search</label>
            <input
              className="input-admin mt-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, company, country, email, notes"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-[220px]">
              <label className="block text-xs font-semibold text-cz-admin-muted">Business type</label>
              <select className="input-admin mt-1" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                <option value="">All</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-[240px]">
              <label className="block text-xs font-semibold text-cz-admin-muted">Product</label>
              <select className="input-admin mt-1" value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="">All</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-[180px]">
              <label className="block text-xs font-semibold text-cz-admin-muted">Date from</label>
              <input
                className="input-admin mt-1"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <label className="block text-xs font-semibold text-cz-admin-muted">Date to</label>
              <input
                className="input-admin mt-1"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-cz-admin-line bg-white px-4 py-8 text-center text-sm text-cz-admin-muted">
              Loading…
            </div>
          ) : leads.length === 0 ? (
            <div className="rounded-2xl border border-cz-admin-line bg-white px-4 py-8 text-center text-sm text-cz-admin-muted">
              No leads match these filters.
            </div>
          ) : (
            leads.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onEdit={setEditing}
                onDelete={setDeleting}
                onViewPhoto={setPhotoPreview}
              />
            ))
          )}
        </div>

        <div className="hidden overflow-hidden rounded-3xl border border-cz-admin-line bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead className="bg-cz-admin-elevated text-xs font-semibold text-cz-admin-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Full name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Business type</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-cz-admin-muted" colSpan={10}>
                      Loading…
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-cz-admin-muted" colSpan={10}>
                      No leads match these filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id} className="border-t border-cz-admin-line">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-cz-admin-muted">{formatWhen(l.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{l.full_name}</td>
                      <td className="px-4 py-3">{l.company}</td>
                      <td className="px-4 py-3">{l.country || ''}</td>
                      <td className="px-4 py-3">{l.email}</td>
                      <td className="px-4 py-3">{l.business_type}</td>
                      <td className="px-4 py-3">{(l.interested_products || []).join(', ')}</td>
                      <td className="max-w-[260px] px-4 py-3 text-cz-admin-muted">
                        <div className="line-clamp-3 whitespace-pre-wrap">{l.notes || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        {l.photo_path ? (
                          <button
                            type="button"
                            className="text-sm font-semibold text-cz-accent underline"
                            onClick={() => setPhotoPreview(l.photo_path)}
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-cz-admin-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          className="mr-3 text-sm font-semibold text-cz-accent"
                          onClick={() => setEditing(l)}
                        >
                          Edit
                        </button>
                        <button type="button" className="text-sm font-semibold text-red-700" onClick={() => setDeleting(l)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
          <div className="max-h-[min(90dvh,100%)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:p-5">
            <LeadEditor
              title="Edit lead"
              initial={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                refresh().catch(() => {});
              }}
            />
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Delete lead?</div>
            <p className="mt-2 text-sm text-cz-admin-muted">
              This will permanently delete <span className="font-semibold text-cz-admin-ink">{deleting.full_name}</span> and
              remove any uploaded photo file.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="min-h-[44px] rounded-2xl border border-cz-admin-line px-4 py-3 text-sm font-semibold" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-2xl bg-red-700 px-4 py-3 text-sm font-semibold text-white"
                onClick={async () => {
                  try {
                    await api.delete(`/leads/${deleting.id}`);
                    setDeleting(null);
                    refresh().catch(() => {});
                  } catch (e) {
                    setError(e?.response?.data?.error || e?.message || 'Delete failed.');
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {photoPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPhotoPreview(null)}>
          <div className="max-h-[90vh] max-w-5xl overflow-auto rounded-3xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Uploaded photo</div>
              <button type="button" className="rounded-xl border border-cz-admin-line px-3 py-2 text-sm font-semibold" onClick={() => setPhotoPreview(null)}>
                Close
              </button>
            </div>
            <img src={photoPreview} alt="Lead upload" className="max-h-[80vh] w-auto max-w-full rounded-2xl" />
          </div>
        </div>
      ) : null}

    </div>
  );
}

function LeadEditor({ title, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState(() => ({
    full_name: initial?.full_name || '',
    company: initial?.company || '',
    country: initial?.country || '',
    email: initial?.email || '',
    business_type: initial?.business_type || 'Distributor',
    notes: initial?.notes || '',
    consent: initial ? Boolean(initial.consent) : true,
  }));
  const [products, setProducts] = useState(() => initial?.interested_products || []);
  const [photo, setPhoto] = useState(null);

  function toggleProduct(p) {
    setProducts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function save() {
    setErr('');
    setBusy(true);
    try {
      const base = {
        full_name: form.full_name.trim(),
        company: form.company.trim(),
        country: form.country.trim(),
        email: form.email.trim(),
        business_type: form.business_type,
        interested_products: products,
        notes: form.notes.trim(),
        consent: form.consent,
      };

      if (!base.full_name || !base.company || !base.email || !base.country) {
        throw new Error('Name, company, country, and email are required.');
      }
      if (!base.consent) {
        throw new Error('Consent must be recorded for this lead.');
      }

      if (isEdit) {
        if (photo) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(base)) {
            if (k === 'interested_products') fd.append(k, JSON.stringify(v));
            else fd.append(k, String(v));
          }
          fd.append('photo', photo);
          await api.put(`/leads/${initial.id}`, fd);
        } else {
          await api.put(`/leads/${initial.id}`, base, { headers: { 'Content-Type': 'application/json' } });
        }
      } else if (photo) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(base)) {
          if (k === 'interested_products') fd.append(k, JSON.stringify(v));
          else fd.append(k, String(v));
        }
        fd.append('photo', photo);
        await api.post('/leads', fd);
      } else {
        await api.post('/leads', base, { headers: { 'Content-Type': 'application/json' } });
      }

      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-cz-admin-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-cz-admin-ink">{title}</div>
          <div className="mt-1 text-sm text-cz-admin-muted">Fast entry — large fields, minimal friction.</div>
        </div>
        <button
          type="button"
          className="min-h-[44px] shrink-0 self-start rounded-2xl border border-cz-admin-line px-3 py-2 text-sm font-semibold sm:self-auto"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {err ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</div> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className="input-admin" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Company" required>
          <input className="input-admin" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </Field>
        <Field label="Email" required>
          <input className="input-admin" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Business type" required>
          <select className="input-admin" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country" required>
          <input className="input-admin" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Field>
        <Field label="Photo (optional)">
          <input
            className="block w-full text-sm text-cz-admin-muted file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-700 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium">Interested products</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PRODUCTS.map((p) => (
            <label key={p} className="flex items-center gap-3 rounded-2xl border border-cz-admin-line px-4 py-3 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={products.includes(p)} onChange={() => toggleProduct(p)} />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Field label="Notes">
          <textarea className="input-admin min-h-[120px] resize-y" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-cz-admin-line px-4 py-4">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
        />
        <span className="text-sm leading-relaxed">I agree to receive communication from Carbon Zapp</span>
      </label>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" className="min-h-[44px] rounded-2xl border border-cz-admin-line px-4 py-3 text-sm font-semibold" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-2xl bg-zinc-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          disabled={busy}
          onClick={() => save().catch(() => {})}
        >
          {busy ? 'Saving…' : 'Save lead'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold text-cz-admin-muted">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </div>
      {children}
    </label>
  );
}
