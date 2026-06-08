import fs from 'node:fs';
import path from 'node:path';

import { buildTemplateDb } from './test-db';

const TMP_ROOT = path.resolve('./tests/.tmp');

/**
 * Vitest globalSetup hook. Runs ONCE before the first worker spins up and is
 * shared across all test files.
 *
 * - Wipes any leftover per-case sqlite directories from a previous run.
 * - Builds `tests/.tmp/_template.db` by running drizzle migrations once.
 *
 * Per-case test databases are then made by copying this template file in
 * `setupTestDbFromTemplate`, which avoids re-running migrations for every
 * `beforeEach`.
 */
export default function globalSetup(): void {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
  buildTemplateDb();
}
