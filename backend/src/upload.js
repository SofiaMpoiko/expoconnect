import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import crypto from 'node:crypto';
import { paths } from './paths.js';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

function extForMime(mime) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(paths.uploadsPhotos, { recursive: true });
    cb(null, paths.uploadsPhotos);
  },
  filename: (_req, file, cb) => {
    const ext = extForMime(file.mimetype) || path.extname(file.originalname || '').slice(0, 8);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    cb(new Error('Invalid file type. Use JPG, PNG, WEBP, or GIF.'));
    return;
  }
  cb(null, true);
}

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
});

export const uploadPhotoOptional = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('photo');

export function publicPhotoUrl(filename) {
  // stored path used by API + frontend
  return `/uploads/photos/${filename}`;
}

export function deletePhotoFileIfExists(photoPath) {
  if (!photoPath) return;
  const normalized = String(photoPath).replace(/^\/+/, '');
  const abs = path.join(paths.root, normalized);
  // only allow deleting inside uploads/photos
  const photosRoot = path.resolve(paths.uploadsPhotos);
  if (!abs.startsWith(photosRoot)) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}
