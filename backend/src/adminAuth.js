import crypto from 'node:crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function sessionKey() {
  const pwd = adminPassword();
  if (!pwd) return null;
  const extra = String(process.env.ADMIN_SESSION_SECRET || 'cz-leads-admin-v1');
  return crypto.createHash('sha256').update(`${pwd}|${extra}`).digest();
}

function b64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function isAdminConfigured() {
  return adminPassword().length > 0;
}

export function verifyPassword(password) {
  const expected = adminPassword();
  if (!expected) return false;

  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Signed token — survives server restarts (unlike in-memory sessions). */
export function createSession() {
  const key = sessionKey();
  if (!key) throw new Error('Admin password not configured.');

  const exp = Date.now() + SESSION_TTL_MS;
  const payload = b64urlEncode(Buffer.from(JSON.stringify({ exp }), 'utf8'));
  const sig = b64urlEncode(crypto.createHmac('sha256', key).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  const key = sessionKey();
  if (!key || !token) return false;

  const parts = String(token).split('.');
  if (parts.length !== 2) return false;

  const [payload, sig] = parts;
  const expected = b64urlEncode(crypto.createHmac('sha256', key).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const data = JSON.parse(b64urlDecode(payload).toString('utf8'));
    return typeof data.exp === 'number' && Date.now() < data.exp;
  } catch {
    return false;
  }
}

export function revokeSession(_token) {
  // Stateless tokens — client discard is enough.
}

export function bearerToken(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

/** Bearer header or `?token=` (for EventSource, which cannot set Authorization). */
export function tokenFromRequest(req) {
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  return String(req.query?.token || '').trim();
}
