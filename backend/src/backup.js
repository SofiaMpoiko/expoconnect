import fs from 'node:fs';
import path from 'node:path';
import { paths } from './paths.js';
import { getDb } from './db.js';

export function backupDatabaseNow() {
  const db = getDb();
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // best-effort
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(paths.backupsDir, `leads-${stamp}.db`);
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  fs.copyFileSync(paths.databaseFile, dest);
}
