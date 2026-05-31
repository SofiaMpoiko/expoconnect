/** Direct module audit (no HTTP) — DB, leads, export zip logic. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(path.join(ROOT, 'backend'));

const results = [];
const pass = (n, d = '') => results.push({ status: 'PASS', name: n, detail: d });
const fail = (n, d = '') => results.push({ status: 'FAIL', name: n, detail: d });
const warn = (n, d = '') => results.push({ status: 'WARN', name: n, detail: d });

async function run() {
  try {
    await import('../backend/src/exportZip.js');
    fail('exportZip import unexpectedly succeeded');
  } catch (e) {
    if (String(e.message).includes('archiver')) {
      fail('exportZip/archiver ESM import blocks API', e.message);
    }
  }

  const { initDatabase } = await import('../backend/src/db.js');
  const { insertLead, getLeadById, listLeads } = await import('../backend/src/leadsService.js');
  const { photoFilenameInZip, buildExportZipBuffer, resolvePhotoAbsPath } = await import('../backend/src/exportZip.js');
  const { paths } = await import('../backend/src/paths.js');
  const { EXPORT_COLUMNS } = await import('../frontend/src/constants.js').catch(() => ({ EXPORT_COLUMNS: null }));

  initDatabase();
  pass('SQLite initDatabase()');

  const dbPath = paths.databaseFile;
  if (fs.existsSync(dbPath)) pass('SQLite file auto-created', dbPath);
  else fail('SQLite file auto-created');

  const lead = insertLead({
    full_name: 'Direct Audit',
    company: 'Test GmbH',
    country: 'Austria',
    email: `direct-${Date.now()}@test.local`,
    business_type: 'Workshop',
    interested_products: ['MTBR'],
    notes: 'Note text',
    consent: true,
    photo_path: null,
  });
  pass('insertLead()', `id=${lead.id}`);

  const again = getLeadById(lead.id);
  if (again?.notes === 'Note text' && again.interested_products?.includes('MTBR')) pass('Read back notes + products');
  else fail('Read back notes + products');

  const listed = listLeads({ search: 'Direct Audit' });
  if (listed.some((l) => l.id === lead.id)) pass('listLeads search');
  else fail('listLeads search');

  // Photo on disk
  const photosDir = paths.uploadsPhotos;
  fs.mkdirSync(photosDir, { recursive: true });
  const fname = `audit-${Date.now()}.png`;
  const absPhoto = path.join(photosDir, fname);
  fs.writeFileSync(absPhoto, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const photoLead = insertLead({
    full_name: 'Photo Lead',
    company: 'Co',
    country: 'CH',
    email: `photo-${Date.now()}@t.local`,
    business_type: 'OEM',
    interested_products: [],
    notes: '',
    consent: true,
    photo_path: `/uploads/photos/${fname}`,
  });
  const zipName = photoFilenameInZip(photoLead);
  if (zipName === `photos/lead-${photoLead.id}-${fname}`) pass('photoFilenameInZip traceability');
  else fail('photoFilenameInZip', zipName);

  if (resolvePhotoAbsPath(photoLead.photo_path)) pass('resolvePhotoAbsPath');
  else fail('resolvePhotoAbsPath');

  const cols = [
    'Date', 'Full Name', 'Company', 'Country', 'Email',
    'Business Type', 'Interested Products', 'Notes', 'Photo', 'Consent',
  ];

  try {
    const zipBuf = await buildExportZipBuffer([photoLead, lead], cols);
    if (zipBuf.length > 500) pass('buildExportZipBuffer', `${zipBuf.length} bytes`);
    else fail('buildExportZipBuffer size');
    const out = path.join(ROOT, 'scripts', '_direct-audit.zip');
    fs.writeFileSync(out, zipBuf);
    pass('ZIP written', out);
  } catch (e) {
    fail('buildExportZipBuffer', e.message);
  }

  if (fs.existsSync(paths.exportsFile)) pass('exports/leads.xlsx on disk');
  else warn('exports/leads.xlsx');

  const backups = fs.existsSync(paths.backupsDir) ? fs.readdirSync(paths.backupsDir) : [];
  if (backups.length) pass('backups exist', `${backups.length} file(s)`);
  else warn('no backup files yet');

  if (!fs.existsSync(path.join(ROOT, 'Dockerfile'))) warn('No Dockerfile in repo');
  if (!fs.existsSync(path.join(ROOT, 'docker-compose.yml'))) warn('No docker-compose.yml in repo');

  console.log(JSON.stringify({
    summary: results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}),
    results,
  }, null, 2));
}

run();
