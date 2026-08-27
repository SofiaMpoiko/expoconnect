import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';

import { backupDatabaseNow } from './backup.js';
import { initDatabase } from './db.js';
import { enqueueThankYouEmail } from './emailQueue.js';
import { startEmailWorker } from './emailWorker.js';
import { rebuildFullLeadsWorkbook } from './excel.js';
import { buildExportZipBuffer } from './exportZip.js';
import {
  bearerToken,
  createSession,
  isAdminConfigured,
  revokeSession,
  tokenFromRequest,
  verifyPassword,
  verifySession,
} from './adminAuth.js';
import { notifyLeadsChanged, subscribeLeadsStream } from './leadEvents.js';
import { deleteLead, getLeadById, insertLead, listLeads, updateLead } from './leadsService.js';
import { paths } from './paths.js';
import { deletePhotoFileIfExists, publicPhotoUrl, uploadPhoto } from './upload.js';
import { extractWebsiteContact } from './websiteContact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

initDatabase();
rebuildFullLeadsWorkbook();

const app = express();
app.set('trust proxy', 1);

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 400),
  standardHeaders: true,
  legacyHeaders: false,
});

const leadsPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LEADS_POST_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

app.use('/uploads', express.static(path.join(paths.root, 'uploads')));

function maybePhotoUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.toLowerCase().includes('multipart/form-data')) {
    return uploadPhoto.single('photo')(req, res, next);
  }
  next();
}

function cleanupUploadedFile(req) {
  try {
    if (req.file?.path) fs.unlinkSync(req.file.path);
  } catch {
    // ignore
  }
}

function parseInterestedProductsFromBody(body) {
  const v = body?.interested_products;
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function baseLeadFields(req) {
  const body = req.body || {};
  return {
    full_name: body.full_name,
    company: body.company,
    country: body.country,
    email: body.email,
    business_type: body.business_type,
    interested_products: parseInterestedProductsFromBody(body),
    notes: body.notes,
    consent: body.consent,
  };
}

function afterLeadMutation() {
  rebuildFullLeadsWorkbook();
  backupDatabaseNow();
  notifyLeadsChanged();
}

function requireAdmin(req, res, next) {
  const token = tokenFromRequest(req);
  if (!verifySession(token)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: 'Admin login is not configured on the server.' });
  }
  const password = String(req.body?.password || '');
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: 'Invalid password.' });
  }
  const token = createSession();
  res.json({ token });
});

app.get('/api/admin/session', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  revokeSession(bearerToken(req));
  res.json({ ok: true });
});

/** Best-effort contact fields from a public website (admin card-scan flow). */
app.post('/api/admin/extract-website', requireAdmin, async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'Missing url.' });
    const contact = await extractWebsiteContact(url);
    res.json({ contact });
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.get('/api/leads', requireAdmin, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const leads = listLeads(req.query);
    res.json({ leads });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/leads/events', requireAdmin, (req, res) => {
  const unsubscribe = subscribeLeadsStream(res);
  req.on('close', unsubscribe);
});

app.post('/api/leads', leadsPostLimiter, maybePhotoUpload, (req, res) => {
  try {
    const body = req.body || {};
    const photo_path = req.file ? publicPhotoUrl(req.file.filename) : body.photo_path || null;
    const lead = insertLead({ ...baseLeadFields(req), photo_path });
    afterLeadMutation();
    enqueueThankYouEmail(lead.id, lead.email);
    res.status(201).json({ lead });
  } catch (e) {
    cleanupUploadedFile(req);
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.put('/api/leads/:id', requireAdmin, maybePhotoUpload, (req, res) => {
  try {
    const id = req.params.id;
    const existing = getLeadById(id);
    if (!existing) {
      cleanupUploadedFile(req);
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const payload = { ...baseLeadFields(req) };
    if (req.file) payload.photo_path = publicPhotoUrl(req.file.filename);
    else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'photo_path')) {
      payload.photo_path = req.body.photo_path || null;
    }

    const oldPhoto = existing.photo_path;
    const lead = updateLead(id, payload);

    if (req.file && oldPhoto && oldPhoto !== lead.photo_path) {
      deletePhotoFileIfExists(oldPhoto);
    }

    afterLeadMutation();
    res.json({ lead });
  } catch (e) {
    cleanupUploadedFile(req);
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  try {
    const result = deleteLead(req.params.id);
    if (!result.deleted) return res.status(404).json({ error: 'Lead not found.' });
    deletePhotoFileIfExists(result.photo_path);
    afterLeadMutation();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/export', requireAdmin, async (req, res) => {
  try {
    const columns = req.body?.columns;
    const filters = req.body?.filters || {};
    const leads = listLeads(filters);
    const zipBuf = await buildExportZipBuffer(leads, columns);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="carbon-zapp-leads.zip"');
    res.send(zipBuf);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post('/api/upload', requireAdmin, uploadPhoto.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file.' });
    res.status(201).json({ url: publicPhotoUrl(req.file.filename) });
  } catch (e) {
    cleanupUploadedFile(req);
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.use((err, req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    cleanupUploadedFile(req);
    return res.status(400).json({ error: 'File is too large.' });
  }
  if (String(err?.message || '').includes('Invalid file type')) {
    cleanupUploadedFile(req);
    return res.status(400).json({ error: err.message });
  }
  cleanupUploadedFile(req);
  res.status(500).json({ error: String(err?.message || err) });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Carbon Zapp leads API listening on :${port}`);
});

startEmailWorker({ intervalMs: 30_000 });
