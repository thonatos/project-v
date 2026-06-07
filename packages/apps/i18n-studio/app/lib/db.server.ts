import path from 'node:path';
import fs from 'node:fs';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '~/db/schema';

const DATABASE_FILE = process.env.DATABASE_FILE || path.resolve('./data/i18n.db');
const MIGRATIONS_FOLDER = path.resolve('./drizzle');

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb() {
  if (_db) return _db;

  ensureDir(DATABASE_FILE);
  const sqlite = new Database(DATABASE_FILE);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  _sqlite = sqlite;

  const db = drizzle(sqlite, { schema });

  if (fs.existsSync(MIGRATIONS_FOLDER)) {
    try {
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    } catch (err) {
      console.error('[db] migrate failed:', err);
    }
  }

  _db = db;
  return _db;
}

export function getSqlite() {
  if (!_sqlite) {
    getDb();
  }
  return _sqlite!;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;
