import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { ZipArchive } from 'archiver';
import { buildWorkbookFromLeads, XLSX } from './excel.js';
import { paths } from './paths.js';

/** Zip path for a lead photo — includes lead id for traceability. */
export function photoFilenameInZip(lead) {
  if (!lead?.photo_path) return '';
  const base = path.basename(String(lead.photo_path));
  if (!base) return '';
  return `photos/lead-${lead.id}-${base}`;
}

export function resolvePhotoAbsPath(photoPath) {
  if (!photoPath) return null;
  const normalized = String(photoPath).replace(/^\/+/, '');
  const abs = path.join(paths.root, normalized);
  const photosRoot = path.resolve(paths.uploadsPhotos);
  if (!abs.startsWith(photosRoot)) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function buildExportZipBuffer(leads, columns) {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    const chunks = [];

    out.on('data', (chunk) => chunks.push(chunk));
    out.on('end', () => resolve(Buffer.concat(chunks)));
    out.on('error', reject);
    archive.on('error', reject);

    archive.pipe(out);

    const leadsForExcel = leads.map((lead) => ({
      ...lead,
      _exportPhotoZip: photoFilenameInZip(lead),
    }));

    const wb = buildWorkbookFromLeads(leadsForExcel, columns);
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    archive.append(xlsxBuf, { name: 'leads.xlsx' });

    const added = new Set();
    for (const lead of leads) {
      const zipName = photoFilenameInZip(lead);
      if (!zipName || added.has(zipName)) continue;
      const abs = resolvePhotoAbsPath(lead.photo_path);
      if (!abs) continue;
      added.add(zipName);
      archive.file(abs, { name: zipName });
    }

    archive.finalize();
  });
}
