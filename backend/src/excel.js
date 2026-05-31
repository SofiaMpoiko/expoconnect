import { createRequire } from 'node:module';
import fs from 'node:fs';
import { paths } from './paths.js';
import { getDb } from './db.js';
import { parseInterestedProducts } from './validation.js';

const require = createRequire(import.meta.url);
export const XLSX = require('xlsx');

function rowFromLead(lead) {
  let products = '';
  try {
    const arr = Array.isArray(lead.interested_products)
      ? lead.interested_products
      : parseInterestedProducts(lead.interested_products);
    products = arr.join(', ');
  } catch {
    products = typeof lead.interested_products === 'string' ? lead.interested_products : '';
  }
  return {
    Date: lead.created_at,
    'Full Name': lead.full_name,
    Company: lead.company,
    Country: lead.country || '',
    Email: lead.email,
    'Business Type': lead.business_type,
    'Interested Products': products,
    Notes: lead.notes || '',
    Photo: lead._exportPhotoZip ?? '',
    'Photo Path': lead.photo_path || '',
    Consent: lead.consent ? 'Yes' : 'No',
  };
}

export function rebuildFullLeadsWorkbook() {
  const db = getDb();
  const leads = db.prepare('SELECT * FROM leads ORDER BY datetime(created_at) DESC').all();

  const rows = leads.map(rowFromLead);
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Date: '', 'Full Name': '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Leads');

  fs.mkdirSync(paths.exportsDir, { recursive: true });
  XLSX.writeFile(wb, paths.exportsFile);
}

export function buildWorkbookFromLeads(leads, columns) {
  const allowed = new Set([
    'Date',
    'Full Name',
    'Company',
    'Country',
    'Email',
    'Business Type',
    'Interested Products',
    'Notes',
    'Photo',
    'Photo Path',
    'Consent',
  ]);

  const cols = (columns || []).filter((c) => allowed.has(c));
  if (!cols.length) {
    throw new Error('No valid columns selected.');
  }

  const rows = leads.map((lead) => {
    const full = rowFromLead(lead);
    const out = {};
    for (const c of cols) out[c] = full[c];
    return out;
  });

  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(cols.map((c) => [c, '']))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Leads');
  return wb;
}
