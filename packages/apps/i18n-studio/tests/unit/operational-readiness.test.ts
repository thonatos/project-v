import { describe, it, expect, vi, afterEach } from 'vitest';

describe('operational readiness guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects missing or default SESSION_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    vi.resetModules();
    await expect(import('~/lib/auth.server')).rejects.toThrow(/SESSION_SECRET/);

    vi.stubEnv('SESSION_SECRET', 'dev-secret-change-me');
    vi.resetModules();
    await expect(import('~/lib/auth.server')).rejects.toThrow(/SESSION_SECRET/);
  });

  it('accepts explicit SESSION_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'prod-secret-with-at-least-32-characters');
    vi.resetModules();
    await expect(import('~/lib/auth.server')).resolves.toBeTruthy();
  });
});
