import fs from 'node:fs';
import Database from 'better-sqlite3';
import { paths } from './paths.js';
import { ensureDirectories } from './fsEnsure.js';

let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    full_name TEXT NOT NULL,
    company TEXT NOT NULL,
    country TEXT,
    email TEXT NOT NULL,
    business_type TEXT NOT NULL,
    interested_products TEXT,
    notes TEXT,
    photo_path TEXT,
    consent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    email TEXT,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    created_at TEXT,
    last_error TEXT
);
`;

export function initDatabase() {
  ensureDirectories();
  if (!fs.existsSync(paths.databaseDir)) {
    fs.mkdirSync(paths.databaseDir, { recursive: true });
  }

  db = new Database(paths.databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  try {
    db.prepare('SELECT last_error FROM email_queue LIMIT 1').get();
  } catch {
    try {
      db.exec('ALTER TABLE email_queue ADD COLUMN last_error TEXT');
    } catch {
      // ignore
    }
  }

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
