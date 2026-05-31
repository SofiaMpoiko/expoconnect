import { getDb } from './db.js';
import {
  isNonEmptyString,
  normalizeString,
  parseInterestedProducts,
  validateEmail,
  validateBusinessType,
  validateInterestedProducts,
  parseConsent,
  BUSINESS_TYPES,
  PRODUCTS,
} from './validation.js';

function mapLeadRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    created_at: row.created_at,
    full_name: row.full_name,
    company: row.company,
    country: row.country,
    email: row.email,
    business_type: row.business_type,
    interested_products: parseInterestedProducts(row.interested_products),
    notes: row.notes,
    photo_path: row.photo_path,
    consent: Boolean(row.consent),
  };
}

export function listLeads(query) {
  const db = getDb();
  const search = normalizeString(query.search);
  const businessType = normalizeString(query.business_type);
  const product = normalizeString(query.product);
  const dateFrom = normalizeString(query.date_from);
  const dateTo = normalizeString(query.date_to);

  const clauses = [];
  const params = [];

  if (search) {
    const safe = search.replace(/[%_]/g, ' ').trim();
    const like = `%${safe}%`;
    clauses.push(
      `(full_name LIKE ? OR company LIKE ? OR country LIKE ? OR email LIKE ? OR IFNULL(notes,'') LIKE ?)`
    );
    params.push(like, like, like, like, like);
  }

  if (businessType && BUSINESS_TYPES.includes(businessType)) {
    clauses.push('business_type = ?');
    params.push(businessType);
  }

  if (product && PRODUCTS.includes(product)) {
    clauses.push(`IFNULL(interested_products,'') LIKE ?`);
    params.push(`%"${product}"%`);
  }

  if (dateFrom) {
    clauses.push(`date(created_at) >= date(?)`);
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push(`date(created_at) <= date(?)`);
    params.push(dateTo);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM leads ${where} ORDER BY datetime(created_at) DESC`;
  const rows = db.prepare(sql).all(...params);
  return rows.map(mapLeadRow);
}

export function getLeadById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id));
  return mapLeadRow(row);
}

export function insertLead(payload) {
  const fullName = normalizeString(payload.full_name);
  const company = normalizeString(payload.company);
  const country = normalizeString(payload.country);
  const notes = normalizeString(payload.notes) || null;

  const emailRes = validateEmail(payload.email);
  if (!emailRes.ok) throw new Error(emailRes.error);

  const btRes = validateBusinessType(payload.business_type);
  if (!btRes.ok) throw new Error(btRes.error);

  const productsRes = validateInterestedProducts(payload.interested_products);
  if (!productsRes.ok) throw new Error(productsRes.error);

  if (!isNonEmptyString(fullName)) throw new Error('Full name is required.');
  if (!isNonEmptyString(company)) throw new Error('Company is required.');
  if (!isNonEmptyString(country)) throw new Error('Country is required.');

  const consent = parseConsent(payload.consent);
  if (!consent) throw new Error('Consent is required to proceed.');

  const createdAt = new Date().toISOString();
  const interestedJson = JSON.stringify(productsRes.value);

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO leads (
        created_at, full_name, company, country, email, business_type,
        interested_products, notes, photo_path, consent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      createdAt,
      fullName,
      company,
      country,
      emailRes.value,
      btRes.value,
      interestedJson,
      notes,
      payload.photo_path || null,
      consent ? 1 : 0
    );

  return getLeadById(info.lastInsertRowid);
}

export function updateLead(id, payload) {
  const existing = getLeadById(id);
  if (!existing) return null;

  const fullName = normalizeString(payload.full_name ?? existing.full_name);
  const company = normalizeString(payload.company ?? existing.company);
  const country = normalizeString(payload.country ?? existing.country ?? '');
  const notes = normalizeString(payload.notes ?? existing.notes ?? '') || null;

  const emailRes = validateEmail(payload.email ?? existing.email);
  if (!emailRes.ok) throw new Error(emailRes.error);

  const btRes = validateBusinessType(payload.business_type ?? existing.business_type);
  if (!btRes.ok) throw new Error(btRes.error);

  const productsRes = validateInterestedProducts(
    payload.interested_products !== undefined ? payload.interested_products : existing.interested_products
  );
  if (!productsRes.ok) throw new Error(productsRes.error);

  if (!isNonEmptyString(fullName)) throw new Error('Full name is required.');
  if (!isNonEmptyString(company)) throw new Error('Company is required.');
  if (!isNonEmptyString(country)) throw new Error('Country is required.');

  const consent =
    payload.consent !== undefined ? parseConsent(payload.consent) : existing.consent;
  if (!consent) throw new Error('Consent is required to proceed.');

  const interestedJson = JSON.stringify(productsRes.value);
  const photoPath =
    payload.photo_path !== undefined ? payload.photo_path || null : existing.photo_path || null;

  const db = getDb();
  db.prepare(
    `UPDATE leads SET
      full_name = ?, company = ?, country = ?, email = ?, business_type = ?,
      interested_products = ?, notes = ?, photo_path = ?, consent = ?
    WHERE id = ?`
  ).run(
    fullName,
    company,
    country,
    emailRes.value,
    btRes.value,
    interestedJson,
    notes,
    photoPath,
    consent ? 1 : 0,
    Number(id)
  );

  return getLeadById(id);
}

export function deleteLead(id) {
  const db = getDb();
  const row = db.prepare('SELECT photo_path FROM leads WHERE id = ?').get(Number(id));
  if (!row) return { deleted: false, photo_path: null };
  db.prepare('DELETE FROM leads WHERE id = ?').run(Number(id));
  return { deleted: true, photo_path: row.photo_path };
}
