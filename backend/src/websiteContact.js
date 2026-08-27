import dns from 'node:dns/promises';
import net from 'node:net';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;

function isPrivateIp(ip) {
  const v = String(ip || '').toLowerCase();
  if (!v) return true;
  if (v === '::1' || v === '0.0.0.0') return true;
  if (v.startsWith('127.') || v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('169.254.')) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  return false;
}

function metaContent(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtml(m[1].trim());
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtml(m2[1].trim()) : '';
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickEmail(candidates, pageHost) {
  const scored = [];
  for (const raw of candidates) {
    const email = String(raw || '').toLowerCase().trim();
    if (!email || email.length > 120) continue;
    if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(email)) continue;
    if (/(example\.com|sentry\.io|wixpress\.com|schema\.org)$/i.test(email.split('@')[1] || '')) continue;
    let score = 0;
    if (pageHost && email.endsWith(`@${pageHost.replace(/^www\./, '')}`)) score += 5;
    if (/^(info|contact|hello|sales|office|admin)@/i.test(email)) score += 2;
    scored.push({ email, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.email || '';
}

function companyFromPage(html, url) {
  const ogSite = metaContent(html, 'og:site_name');
  if (ogSite) return ogSite.slice(0, 120);

  const ogTitle = metaContent(html, 'og:title');
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? decodeHtml(titleMatch[1]) : '';
  const candidate = ogTitle || title;
  if (candidate) {
    const cleaned = candidate
      .split(/\s[|\-–—:]\s/)[0]
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    if (cleaned && cleaned.length >= 2) return cleaned;
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    return host || url;
  } catch {
    return url;
  }
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed.');
  }

  const hostname = parsed.hostname;
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local addresses are not allowed.');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Private addresses are not allowed.');
  } else {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) throw new Error('Could not resolve host.');
    for (const r of records) {
      if (isPrivateIp(r.address)) throw new Error('Private addresses are not allowed.');
    }
  }
  return parsed.toString();
}

/**
 * Best-effort: fetch a public page and extract email + company label.
 * Falls back to the URL as company when no better name is found.
 */
export async function extractWebsiteContact(rawUrl) {
  const safeUrl = await assertSafeUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(safeUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'CarbonZappLeadsBot/1.0 (+local exhibition lead capture)',
      },
    });

    if (!res.ok) {
      return {
        full_name: '',
        company: safeUrl,
        email: '',
        source_url: safeUrl,
        note: `Website returned HTTP ${res.status}.`,
      };
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const html = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    const text = stripTags(html);

    const mailto = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1]));
    const inText = text.match(EMAIL_RE) || [];
    const email = pickEmail([...mailto, ...inText], new URL(safeUrl).hostname);

    const company = companyFromPage(html, safeUrl) || safeUrl;

    return {
      full_name: '',
      company,
      email,
      source_url: safeUrl,
      note: email
        ? 'Contact details guessed from website linked on the card QR.'
        : 'No email found on website; company set from page or URL.',
    };
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Website fetch timed out.' : String(e?.message || e);
    return {
      full_name: '',
      company: safeUrl,
      email: '',
      source_url: safeUrl,
      note: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
