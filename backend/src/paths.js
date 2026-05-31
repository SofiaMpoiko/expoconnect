import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Monorepo root (parent of /backend) */
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

export const paths = {
  /** Alias for monorepo root */
  root: ROOT_DIR,
  databaseDir: path.join(ROOT_DIR, 'database'),
  databaseFile: path.join(ROOT_DIR, 'database', 'leads.db'),
  uploadsPhotos: path.join(ROOT_DIR, 'uploads', 'photos'),
  exportsDir: path.join(ROOT_DIR, 'exports'),
  exportsFile: path.join(ROOT_DIR, 'exports', 'leads.xlsx'),
  backupsDir: path.join(ROOT_DIR, 'backups'),
  cataloguesDir: path.join(ROOT_DIR, 'catalogues'),
  cataloguePdf: path.join(ROOT_DIR, 'catalogues', 'catalogue.pdf'),
};
