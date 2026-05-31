import fs from 'node:fs';
import { paths } from './paths.js';

const dirs = [
  paths.databaseDir,
  paths.uploadsPhotos,
  paths.exportsDir,
  paths.backupsDir,
  paths.cataloguesDir,
];

export function ensureDirectories() {
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
