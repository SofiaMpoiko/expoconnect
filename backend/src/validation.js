export const BUSINESS_TYPES = ['OEM', 'Workshop', 'Distributor', 'Other'];

export const PRODUCTS = ['LTBR', 'MTBR', 'ITBR', 'CTBR', 'PTRB', 'GTBR', 'HTBR', 'ETBR', 'OTHER'];

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function normalizeString(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

export function parseInterestedProducts(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((p) => normalizeString(p)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => normalizeString(p)).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return [];
}

export function validateEmail(email) {
  const e = normalizeString(email);
  if (!e) return { ok: false, error: 'Email is required.' };
  if (!EMAIL_RE.test(e)) return { ok: false, error: 'Email is not valid.' };
  return { ok: true, value: e };
}

/** Empty allowed; non-empty must be a valid email (admin manual entry). */
export function validateEmailOptional(email) {
  const e = normalizeString(email);
  if (!e) return { ok: true, value: '' };
  if (!EMAIL_RE.test(e)) return { ok: false, error: 'Email is not valid.' };
  return { ok: true, value: e };
}

export function validateBusinessType(v) {
  const t = normalizeString(v);
  if (!t) return { ok: true, value: '' };
  // Accept current options plus legacy "Trader" already stored in older leads.
  if (!BUSINESS_TYPES.includes(t) && t !== 'Trader') {
    return { ok: false, error: 'Business type is invalid.' };
  }
  return { ok: true, value: t };
}

export function validateInterestedProducts(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = [];
  for (const p of list) {
    const n = normalizeString(p);
    if (!n) continue;
    if (!PRODUCTS.includes(n)) {
      return { ok: false, error: `Invalid product: ${n}` };
    }
    cleaned.push(n);
  }
  return { ok: true, value: cleaned };
}

export function parseConsent(raw) {
  if (raw === true || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 0 || raw === '0') return false;
  const s = normalizeString(raw).toLowerCase();
  return s === 'true' || s === 'on' || s === 'yes';
}
