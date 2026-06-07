import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, type TestEnv } from './test-db';

describe('namespace + entry flow', () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupTestDb();
    // db.server caches singleton — must reset module cache
    vi.resetModules();
  });

  afterEach(() => env.cleanup());

  it('creates ns + upserts entry + publishes; bundleVersion increments once', async () => {
    const { registerUser } = await import('~/lib/auth.server');
    const { createNamespace } = await import('~/lib/services/namespace.server');
    const { upsertEntry, getEntryByKey } = await import('~/lib/services/entry.server');
    const { getDb } = await import('~/lib/db.server');
    const { namespaces } = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    const user = await registerUser('alice@x.com', 'password123', 'Alice');
    const ns = createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
    expect(ns.bundleVersion).toBe(0);

    upsertEntry({
      namespaceId: ns.id,
      key: 'home.title',
      translations: { 'zh-cn': '首页', 'en-us': 'Home' },
      asDraft: false,
      actorId: user.id,
    });

    const db = getDb();
    const after = db.select().from(namespaces).where(eq(namespaces.id, ns.id)).get()!;
    expect(after.bundleVersion).toBe(1); // 一次 upsert 涉及两条 published,但只 +1

    const entry = getEntryByKey(ns.id, 'home.title');
    expect(entry).toBeTruthy();
  });

  it('as_draft does not bump bundleVersion', async () => {
    const { registerUser } = await import('~/lib/auth.server');
    const { createNamespace } = await import('~/lib/services/namespace.server');
    const { upsertEntry } = await import('~/lib/services/entry.server');
    const { getDb } = await import('~/lib/db.server');
    const { namespaces } = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    const user = await registerUser('alice@x.com', 'password123', 'Alice');
    const ns = createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
    upsertEntry({
      namespaceId: ns.id,
      key: 'home.title',
      translations: { 'zh-cn': '首页' },
      asDraft: true,
      actorId: user.id,
    });
    const db = getDb();
    const after = db.select().from(namespaces).where(eq(namespaces.id, ns.id)).get()!;
    expect(after.bundleVersion).toBe(0);
  });

  it('publish from draft and revert', async () => {
    const { registerUser } = await import('~/lib/auth.server');
    const { createNamespace } = await import('~/lib/services/namespace.server');
    const { upsertEntry, getEntryByKey } = await import('~/lib/services/entry.server');
    const { publishOne, discard } = await import('~/lib/services/publish.server');
    const { listVersions, revert } = await import('~/lib/services/version.server');

    const user = await registerUser('alice@x.com', 'password123', 'Alice');
    const ns = createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
    // 写入 draft v1
    upsertEntry({ namespaceId: ns.id, key: 'a.b', translations: { 'zh-cn': 'v1' }, asDraft: true, actorId: user.id });
    const entry = getEntryByKey(ns.id, 'a.b')!;
    let history = listVersions(entry.id, 'zh-cn');
    expect(history.versions[0]?.status).toBe('draft');

    // publish v1
    publishOne(entry.id, 'zh-cn', 1, user.id);
    history = listVersions(entry.id, 'zh-cn');
    expect(history.currentPublishedVersion).toBe(1);

    // 写入 published v2
    upsertEntry({ namespaceId: ns.id, key: 'a.b', translations: { 'zh-cn': 'v2' }, asDraft: false, actorId: user.id });
    history = listVersions(entry.id, 'zh-cn');
    expect(history.currentPublishedVersion).toBe(2);

    // revert -> v3 = v1 的值
    const r = revert(entry.id, 'zh-cn', 1, user.id);
    expect(r.newVersion).toBe(3);
    history = listVersions(entry.id, 'zh-cn');
    expect(history.versions[0]?.value).toBe('v1');
    expect(history.versions[0]?.source).toBe('revert');

    // discard 不存在的 draft 应抛
    expect(() => discard(entry.id, 'zh-cn', 999, user.id)).toThrow();
  });

  it('keeps at least one admin', async () => {
    const { registerUser } = await import('~/lib/auth.server');
    const { createNamespace } = await import('~/lib/services/namespace.server');
    const { updateRole } = await import('~/lib/services/membership.server');

    const user = await registerUser('alice@x.com', 'password123', 'Alice');
    const ns = createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
    expect(() => updateRole(ns.id, user.id, 'editor')).toThrow();
  });

  it('rejects removing locale with published refs', async () => {
    const { registerUser } = await import('~/lib/auth.server');
    const { createNamespace, updateNamespace } = await import('~/lib/services/namespace.server');
    const { upsertEntry } = await import('~/lib/services/entry.server');

    const user = await registerUser('alice@x.com', 'password123', 'Alice');
    const ns = createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
    upsertEntry({
      namespaceId: ns.id,
      key: 'a',
      translations: { 'en-us': 'A' },
      actorId: user.id,
    });
    expect(() => updateNamespace('docs', { locales: ['zh-cn', 'zh-tw'], defaultLocale: 'zh-cn' })).toThrow();
  });
});
