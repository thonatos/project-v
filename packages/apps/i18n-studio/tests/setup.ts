import { beforeAll } from 'vitest';

beforeAll(() => {
  // Each test case still resets DATABASE_FILE inside `setupTestDbFromTemplate`,
  // but we set a stable SESSION_SECRET here so any module imported before the
  // first reset doesn't fall back to an environment-dependent default.
  process.env.SESSION_SECRET ??= 'test-secret';
});
