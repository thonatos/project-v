import path from 'node:path';
import fs from 'node:fs';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '~/db/schema';

const MIGRATIONS = path.resolve('./drizzle');
const TMP_ROOT = path.resolve('./tests/.tmp');
const TEMPLATE_DB = path.join(TMP_ROOT, '_template.db');

export interface TestEnv {
  dbFile: string;
  cleanup: () => void;
}

/**
 * Build the migrated template database once. Each test case copies this file
 * instead of running drizzle's `migrate()` from scratch — significantly faster
 * when the suite has many cases (see openspec change i18n-studio-modernization,
 * spec i18n-studio-testing).
 *
 * Idempotent: if the template already exists, this is a no-op.
 */
export function buildTemplateDb(): void {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  if (fs.existsSync(TEMPLATE_DB)) return;
  const sqlite = new Database(TEMPLATE_DB);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  sqlite.close();
}

export function templateDbPath(): string {
  return TEMPLATE_DB;
}

/**
 * Initialize a fresh per-case database by cloning the migrated template.
 * Sets `DATABASE_FILE` so `~/lib/db.server` opens the new file when the test
 * `vi.resetModules()` and re-imports services.
 */
export function setupTestDbFromTemplate(): TestEnv {
  if (!fs.existsSync(TEMPLATE_DB)) {
    // Local fallback: tests invoked directly without globalSetup (e.g. an IDE
    // running a single file) should still work.
    buildTemplateDb();
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'db-'));
  const dbFile = path.join(dir, 'test.db');
  fs.copyFileSync(TEMPLATE_DB, dbFile);
  process.env.DATABASE_FILE = dbFile;
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

export const setupTestDb = setupTestDbFromTemplate;
