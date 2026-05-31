/**
 * Production readiness audit — requires API on AUDIT_PORT (default 3001).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.AUDIT_PORT || 3001;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const pass = (name, detail = '') => results.push({ status: 'PASS', name, detail });
const fail = (name, detail = '') => results.push({ status: 'FAIL', name, detail });
const warn = (name, detail = '') => results.push({ status: 'WARN', name, detail });

async function req(method, urlPath, { body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let bodyInit = body;
  if (body instanceof FormData) {
    bodyInit = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: bodyInit });
  const ct = res.headers.get('content-type') || '';
  let data;
  if (ct.includes('json')) data = await res.json();
  else data = Buffer.from(await res.arrayBuffer());
  return { res, data, ct };
}

function inspectZip(buf, photoLeadId, photoZipName) {
  const XLSX = require(path.join(ROOT, 'backend/node_modules/xlsx'));
  const AdmZip = require(path.join(ROOT, 'backend/node_modules/adm-zip'));
  const zip = new AdmZip(buf);
  const entries = zip.getEntries().map((e) => e.entryName);

  if (entries.includes('leads.xlsx')) pass('ZIP contains leads.xlsx');
  else fail('ZIP contains leads.xlsx', entries.join(', '));

  const photoEntries = entries.filter((e) => e.startsWith('photos/'));
  if (photoEntries.length > 0) pass('ZIP contains photos/', `${photoEntries.length} file(s)`);
  else fail('ZIP contains photos/');

  if (photoZipName && photoEntries.includes(photoZipName)) {
    pass('ZIP contains expected photo file', photoZipName);
  } else if (photoZipName) {
    fail('ZIP contains expected photo file', `expected ${photoZipName}, got ${photoEntries.join(', ')}`);
  }

  const xlsxEntry = zip.getEntry('leads.xlsx');
  if (xlsxEntry) {
    const wb = XLSX.read(xlsxEntry.getData(), { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const photoRow = rows.find((r) => String(r.Email || '').includes('audit-photo'));
    if (photoRow?.Photo === photoZipName) {
      pass('Excel Photo column matches ZIP path', photoRow.Photo);
    } else {
      fail('Excel Photo column matches ZIP path', JSON.stringify(photoRow?.Photo));
    }
  }
}

async function main() {
  try {
    const { res, data } = await req('GET', '/api/health');
    if (res.ok && data?.ok) pass('API health', BASE);
    else fail('API health', `status ${res.status}`);
  } catch (e) {
    fail('API reachable', e.message);
    printReport();
    process.exit(1);
  }

  const adminPassword = process.env.AUDIT_ADMIN_PASSWORD || 'admin123';
  const login = await req('POST', '/api/admin/login', { body: { password: adminPassword } });
  let token = '';
  if (login.res.ok && login.data?.token) {
    token = login.data.token;
    pass('Admin login');
  } else fail('Admin login', login.data?.error || String(login.res.status));

  const payload = {
    full_name: 'Audit User',
    company: 'Audit Co',
    country: 'Germany',
    email: `audit-${Date.now()}@example.com`,
    business_type: 'Distributor',
    interested_products: ['LTBR', 'OTHER'],
    notes: 'Audit notes line',
    consent: true,
  };

  const create = await req('POST', '/api/leads', { body: payload });
  if (create.res.status === 201 && create.data?.lead?.id) {
    pass('Lead JSON create', `id=${create.data.lead.id}`);
    const l = create.data.lead;
    if (l.notes === payload.notes && l.interested_products?.includes('LTBR')) pass('Lead notes + interests stored');
    else fail('Lead notes + interests stored');
  } else fail('Lead JSON create', create.data?.error || String(create.res.status));

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const photoEmail = `audit-photo-${Date.now()}@example.com`;
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...payload, email: photoEmail })) {
    if (k === 'interested_products') fd.append(k, JSON.stringify(v));
    else fd.append(k, String(v));
  }
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'audit.png');

  const createPhoto = await req('POST', '/api/leads', { body: fd });
  let photoLeadId;
  let photoPath;
  let photoZipName;
  if (createPhoto.res.status === 201 && createPhoto.data?.lead?.photo_path) {
    photoLeadId = createPhoto.data.lead.id;
    photoPath = createPhoto.data.lead.photo_path;
    photoZipName = `photos/lead-${photoLeadId}-${path.basename(photoPath)}`;
    pass('Lead create with photo', photoPath);
    const abs = path.join(ROOT, photoPath.replace(/^\//, ''));
    if (fs.existsSync(abs)) pass('Photo file on disk', abs);
    else fail('Photo file on disk');
    if (createPhoto.data.lead.id && createPhoto.data.lead.photo_path.includes(path.basename(photoPath))) {
      pass('Photo linked to lead in API response');
    }
  } else {
    fail('Lead create with photo', createPhoto.data?.error || String(createPhoto.res.status));
  }

  const dbFile = path.join(ROOT, 'database', 'leads.db');
  if (fs.existsSync(dbFile)) pass('SQLite file exists', dbFile);
  else fail('SQLite file exists');

  if (token) {
    const list = await req('GET', '/api/leads', { token });
    if (list.res.ok && list.data?.leads?.some((l) => l.email === photoEmail)) pass('Lead in SQLite via list API');
    else fail('Lead in SQLite via list API');

    const search = await req('GET', '/api/leads?search=Audit', { token });
    if (search.data?.leads?.some((l) => l.full_name === 'Audit User')) pass('Search filter');
    else warn('Search filter');

    const exportRes = await req('POST', '/api/export', {
      token,
      body: {
        columns: [
          'Date', 'Full Name', 'Company', 'Country', 'Email',
          'Business Type', 'Interested Products', 'Notes', 'Photo', 'Consent',
        ],
        filters: { search: 'audit-photo' },
      },
    });
    if (exportRes.res.ok && exportRes.ct.includes('zip')) {
      pass('Export Data ZIP', `${exportRes.data.length} bytes`);
      try {
        inspectZip(exportRes.data, photoLeadId, photoZipName);
      } catch (e) {
        fail('ZIP inspection', e.message);
      }
    } else fail('Export Data ZIP', `status ${exportRes.res.status}`);

    const noAuth = await req('GET', '/api/leads');
    if (noAuth.res.status === 401) pass('Leads API requires auth');
    else fail('Leads API requires auth');
  }

  if (fs.existsSync(path.join(ROOT, 'Dockerfile'))) pass('Dockerfile present');
  else fail('Dockerfile present');
  if (fs.existsSync(path.join(ROOT, 'docker-compose.yml'))) pass('docker-compose.yml present');
  else fail('docker-compose.yml present');

  const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
  for (const mount of ['data/database', 'data/uploads', 'data/exports', 'data/backups']) {
    if (compose.includes(mount)) pass(`Volume mount: ${mount}`);
    else fail(`Volume mount: ${mount}`);
  }

  printReport();
}

function printReport() {
  const summary = results.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {});
  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.FAIL > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
