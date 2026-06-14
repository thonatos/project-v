import { spawnSync } from 'node:child_process';
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

  it('keeps OpenAPI coverage and documentation contract scripts passing', () => {
    const coverage = spawnSync(process.execPath, ['scripts/check-openapi-coverage.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(coverage.status, coverage.stdout + coverage.stderr).toBe(0);

    const docs = spawnSync(process.execPath, ['scripts/check-doc-contracts.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(docs.status, docs.stdout + docs.stderr).toBe(0);
  });
});
