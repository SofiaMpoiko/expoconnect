const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const TITLE_HINTS = /^(mr|mrs|ms|miss|dr|prof|eng|ir)\.?$/i;
const ROLE_HINTS =
  /\b(ceo|cto|cfo|coo|founder|director|manager|engineer|sales|marketing|owner|president|partner|consultant|specialist|executive|head of|lead)\b/i;
const SKIP_LINE =
  /^(tel|phone|fax|mobile|www\.|http|https|p\.?\s*o\.?\s*box|address|street|suite|floor)\b/i;

function cleanLine(s) {
  return String(s || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const k = String(x || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(x).trim());
  }
  return out;
}

export function extractEmails(text) {
  const matches = String(text || '').match(EMAIL_RE) || [];
  return uniq(matches).filter((e) => !/\.(png|jpe?g|gif|svg|css|js)$/i.test(e));
}

export function looksLikeUrl(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeHttpUrl(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function unescapeVcard(value) {
  return String(value || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseVcardName(fn, n) {
  if (fn) return unescapeVcard(fn);
  if (!n) return '';
  const parts = unescapeVcard(n).split(';');
  const family = parts[0] || '';
  const given = parts[1] || '';
  return cleanLine(`${given} ${family}`);
}

/** Parse BEGIN:VCARD … END:VCARD */
export function parseVCard(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  if (!/BEGIN:VCARD/i.test(text)) return null;

  const fields = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const keyPart = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = keyPart.split(';')[0].toUpperCase();
    if (!fields[key]) fields[key] = value;
    else if (key === 'EMAIL' || key === 'TEL' || key === 'URL') {
      fields[key] = `${fields[key]}\n${value}`;
    }
  }

  const emails = extractEmails(fields.EMAIL || text);
  const org = unescapeVcard((fields.ORG || '').split(';')[0] || '');
  const full_name = parseVcardName(fields.FN, fields.N);
  const url = unescapeVcard((fields.URL || '').split('\n')[0] || '');

  return {
    full_name,
    company: org,
    email: emails[0] || '',
    url: normalizeHttpUrl(url) || '',
    source: 'vcard',
  };
}

/** Parse MECARD:N:…;ORG:…;EMAIL:…;; */
export function parseMeCard(raw) {
  const text = String(raw || '').trim();
  if (!/^MECARD:/i.test(text)) return null;

  const body = text.replace(/^MECARD:/i, '');
  const get = (key) => {
    const re = new RegExp(`${key}:([^;]*)`, 'i');
    const m = body.match(re);
    return m?.[1] ? cleanLine(m[1]) : '';
  };

  const emails = extractEmails(get('EMAIL') || body);
  return {
    full_name: get('N'),
    company: get('ORG') || get('CORP'),
    email: emails[0] || '',
    url: normalizeHttpUrl(get('URL')) || '',
    source: 'mecard',
  };
}

function scoreNameLine(line) {
  const s = cleanLine(line);
  if (!s || s.length < 2 || s.length > 60) return -1;
  if (EMAIL_RE.test(s) || looksLikeUrl(s)) return -1;
  if (SKIP_LINE.test(s) || ROLE_HINTS.test(s)) return -1;
  if (/\d{3,}/.test(s)) return -1;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return -1;
  if (words.every((w) => TITLE_HINTS.test(w))) return -1;
  let score = 0;
  if (words.length >= 2 && words.length <= 4) score += 3;
  if (/^[A-Za-zÀ-ÿ'’.\-\s]+$/.test(s)) score += 2;
  if (words.some((w) => w === w.toUpperCase() && w.length > 1 && w.length < 4)) score -= 1;
  return score;
}

function scoreCompanyLine(line, nameLine) {
  const s = cleanLine(line);
  if (!s || s.length < 2 || s.length > 80) return -1;
  if (EMAIL_RE.test(s) || looksLikeUrl(s)) return -1;
  if (SKIP_LINE.test(s)) return -1;
  if (nameLine && s.toLowerCase() === nameLine.toLowerCase()) return -1;
  let score = 1;
  if (/\b(ltd|llc|inc|gmbh|oy|ab|sa|bv|co\.|company|group|industries|solutions|technologies|corp)\b/i.test(s)) {
    score += 4;
  }
  if (s === s.toUpperCase() && s.length >= 3 && s.length <= 40) score += 2;
  if (ROLE_HINTS.test(s)) score -= 2;
  return score;
}

/** Best-effort name/company/email from free text (OCR or plain QR). */
export function parseContactText(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const emails = extractEmails(text);
  const lines = text
    .split(/\n| {2,}|\|/)
    .map(cleanLine)
    .filter(Boolean);

  let full_name = '';
  let bestName = -1;
  for (const line of lines) {
    const sc = scoreNameLine(line);
    if (sc > bestName) {
      bestName = sc;
      full_name = line;
    }
  }

  let company = '';
  let bestCo = -1;
  for (const line of lines) {
    const sc = scoreCompanyLine(line, full_name);
    if (sc > bestCo) {
      bestCo = sc;
      company = line;
    }
  }

  return {
    full_name: bestName >= 2 ? full_name : bestName >= 0 ? full_name : '',
    company: bestCo >= 1 ? company : '',
    email: emails[0] || '',
    url: '',
    source: 'text',
  };
}

/**
 * Interpret raw QR payload into contact fields.
 * May return `{ type: 'url', url }` for website follow-up.
 */
export function interpretQrPayload(raw) {
  const text = String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) return { type: 'empty' };

  const vcard = parseVCard(text);
  if (vcard) {
    return {
      type: 'contact',
      contact: vcard,
      raw: text,
    };
  }

  const mecard = parseMeCard(text);
  if (mecard) {
    return {
      type: 'contact',
      contact: mecard,
      raw: text,
    };
  }

  const compact = cleanLine(text);
  const url = normalizeHttpUrl(compact);
  const emailsInPayload = extractEmails(text);
  const looksLikeLoneUrl =
    Boolean(url) &&
    !emailsInPayload.length &&
    !/\s/.test(compact) &&
    (looksLikeUrl(compact) ||
      /^https?:\/\//i.test(compact) ||
      /^www\./i.test(compact) ||
      /^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(compact));

  if (looksLikeLoneUrl) {
    return { type: 'url', url, raw: text };
  }

  const contact = parseContactText(text);
  if (contact.email || contact.full_name || contact.company) {
    return { type: 'contact', contact, raw: text };
  }

  if (url) return { type: 'url', url, raw: text };

  return { type: 'unknown', raw: text, contact: { full_name: '', company: '', email: '', url: '', source: 'unknown' } };
}

export function emptyContact() {
  return { full_name: '', company: '', email: '', notes: '' };
}

export function mergeContactNotes(contact, extraNote) {
  const notes = [contact.notes, extraNote].filter(Boolean).join('\n');
  return { ...contact, notes };
}
