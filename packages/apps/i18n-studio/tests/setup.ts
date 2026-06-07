import { afterEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/.tmp/test.db');

beforeAll(() => {
  process.env.DATABASE_FILE = TEST_DB;
  process.env.SESSION_SECRET = 'test-secret';
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  fs.mkdirSync(path.dirname(TEST_DB), { recursive: true });
});

afterEach(() => {
  // 每个测试自行管理状态;若需要清空可在测试内调用 reset helper
});
