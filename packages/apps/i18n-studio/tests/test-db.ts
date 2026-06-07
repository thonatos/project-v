import path from 'node:path';
import fs from 'node:fs';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '~/db/schema';

const MIGRATIONS = path.resolve('./drizzle');
const TMP_ROOT = path.resolve('./tests/.tmp');

export interface TestEnv {
  dbFile: string;
  cleanup: () => void;
}

export function setupTestDb(): TestEnv {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'db-'));
  const dbFile = path.join(dir, 'test.db');
  process.env.DATABASE_FILE = dbFile;
  const sqlite = new Database(dbFile);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  sqlite.close();
  return {
    dbFile,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
