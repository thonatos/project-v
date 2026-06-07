import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.12 Snapshot 通道:
 *  - 公开命名空间(publicRead=true)免 token
 *  - 私有命名空间需 readonly token,scope=task token 不可访问
 *  - bundle_version 触发 ETag 变化
 *  - bundle_version 参数固定快照
 */
describe('snapshot channel', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  async function seedDocsPublished() {
    const w = await seedWorld(ctx);
    const { entry } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': '中A', 'en-us': 'EN-A' },
      actorId: w.alice.id,
    });
    return w;
  }

  it('公开:无 Authorization 即可访问', async () => {
    const w = await seedDocsPublished();
    ctx.api.namespace.updateNamespace('docs', { publicRead: true });
    const req = new Request('https://x/snapshot/docs');
    const r = ctx.api.snapshot.requireSnapshotAccess(req, 'docs');
    expect(r.isPublic).toBe(true);
  });

  it('私有 + 无 token → 401', async () => {
    await seedDocsPublished();
    const req = new Request('https://x/snapshot/docs');
    expect(() => ctx.api.snapshot.requireSnapshotAccess(req, 'docs')).toThrow();
  });

  it('私有 + readonly token 通过', async () => {
    const w = await seedDocsPublished();
    const { plaintext } = ctx.api.apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'r',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    const req = new Request('https://x/snapshot/docs', {
      headers: { Authorization: `Bearer ${plaintext}` },
    });
    const r = ctx.api.snapshot.requireSnapshotAccess(req, 'docs');
    expect(r.isPublic).toBe(false);
  });

  it('私有 + scope=task token → 401', async () => {
    const w = await seedDocsPublished();
    const { plaintext } = ctx.api.apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 't',
      scope: 'task',
      createdBy: w.alice.id,
    });
    const req = new Request('https://x/snapshot/docs', {
      headers: { Authorization: `Bearer ${plaintext}` },
    });
    expect(() => ctx.api.snapshot.requireSnapshotAccess(req, 'docs')).toThrow();
  });

  it('readonly token 仅可访问签发的 ns', async () => {
    const w = await seedDocsPublished();
    const { plaintext } = ctx.api.apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'r',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    const req = new Request('https://x/snapshot/artx', {
      headers: { Authorization: `Bearer ${plaintext}` },
    });
    expect(() => ctx.api.snapshot.requireSnapshotAccess(req, 'artx')).toThrow();
  });

  it('getBundle:返回当前 bundleVersion + ETag,locales 排序后稳定', async () => {
    const w = await seedDocsPublished();
    const a = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn', 'en-us'] });
    const b = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['en-us', 'zh-cn'] });
    expect(a.meta.etag).toBe(b.meta.etag);
    expect(a.bundle.locales['zh-cn']!['a']).toBe('中A');
  });

  it('bump bundle:再发布一次 → ETag 变化', async () => {
    const w = await seedDocsPublished();
    const before = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'] });
    ctx.api.entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': '中A2' },
      actorId: w.alice.id,
    });
    const after = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'] });
    expect(after.meta.etag).not.toBe(before.meta.etag);
    expect(after.bundle.locales['zh-cn']!['a']).toBe('中A2');
  });

  it('bundleVersion 参数:写入 ETag,且按当前 schema 等价于 atVersion 过滤', async () => {
    const w = await seedDocsPublished();
    // 此时 bundleVersion=1,a 的 zh-cn 历史 v1='中A'
    ctx.api.entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': '中A2' },
      actorId: w.alice.id,
    });
    // 现在 bundleVersion=2,a 的 zh-cn 历史 v2='中A2'
    const fixed = ctx.api.snapshot.getBundle({
      slug: 'docs',
      locales: ['zh-cn'],
      bundleVersion: 1,
    });
    // 当前实现把 bundleVersion 当作 atVersion 走 translation_versions.version <= 1
    // tv.version 是每个 (entry,locale) 内部的递增,因此 v1='中A'
    expect(fixed.bundle.locales['zh-cn']!['a']).toBe('中A');
    // ETag 包含 atVersion 段
    expect(fixed.meta.etag).toContain('-1"');
  });

  it('未启用 locale → 抛 422', async () => {
    await seedDocsPublished();
    expect(() => ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['fr-fr'] })).toThrow();
  });
});
