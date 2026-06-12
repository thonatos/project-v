import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('export & snapshot', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  describe('exportFlat', () => {
    async function seed() {
      const w = await seedWorld(ctx);
      const { entry } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中AB', 'en-us': 'EN-AB' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.c',
        translations: { 'zh-cn': '中AC' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.d',
        translations: { 'zh-cn': '草稿AD' },
        asDraft: true,
        actorId: w.alice.id,
      });
      return w;
    }

    it('单 locale:平铺 key->value', async () => {
      const w = await seed();
      const out = ctx.api.exporter.exportFlat({
        namespaceId: w.docs.id,
        locale: ['zh-cn'],
      }) as Record<string, string>;
      expect(out['a.b']).toBe('中AB');
      expect(out['a.c']).toBe('中AC');
      expect(out['a.d']).toBeUndefined();
    });

    it('多 locale:顶层 locale -> {key:value}', async () => {
      const w = await seed();
      const out = ctx.api.exporter.exportFlat({
        namespaceId: w.docs.id,
        locale: ['zh-cn', 'en-us'],
      }) as Record<string, Record<string, string>>;
      expect(out['zh-cn']!['a.b']).toBe('中AB');
      expect(out['en-us']!['a.b']).toBe('EN-AB');
      expect(out['en-us']!['a.c']).toBeUndefined();
    });

    it('at_version:基于 translation_versions 历史快照', async () => {
      const w = await seed();
      const { entry, exporter } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中AB-v2' },
        actorId: w.alice.id,
      });
      const v1 = exporter.exportFlat({
        namespaceId: w.docs.id,
        locale: ['zh-cn'],
        atVersion: 1,
      }) as Record<string, string>;
      expect(v1['a.b']).toBe('中AB');
      const latest = exporter.exportFlat({
        namespaceId: w.docs.id,
        locale: ['zh-cn'],
      }) as Record<string, string>;
      expect(latest['a.b']).toBe('中AB-v2');
    });

    it('未启用 locale → 抛错', async () => {
      const w = await seed();
      expect(() =>
        ctx.api.exporter.exportFlat({
          namespaceId: w.docs.id,
          locale: ['fr-fr'],
        }),
      ).toThrow();
    });

    it('omit locale:默认导出全部 ns 启用的 locale', async () => {
      const w = await seed();
      const out = ctx.api.exporter.exportFlat({
        namespaceId: w.docs.id,
      }) as Record<string, Record<string, string>>;
      expect(Object.keys(out).sort()).toEqual(['en-us', 'zh-cn', 'zh-tw']);
    });
  });

  describe('snapshot channel', () => {
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
      await seedDocsPublished();
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
      await seedDocsPublished();
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

    it('bundleVersion 参数:按 release manifest 固定读取', async () => {
      const w = await seedDocsPublished();
      ctx.api.entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a',
        translations: { 'zh-cn': '中A2' },
        actorId: w.alice.id,
      });
      const fixed = ctx.api.snapshot.getBundle({
        slug: 'docs',
        locales: ['zh-cn'],
        bundleVersion: 1,
      });
      expect(fixed.bundle.locales['zh-cn']!['a']).toBe('中A');
      expect(fixed.meta.etag).toContain('-1"');
    });

    it('bundleVersion 缺失 release → 404', async () => {
      await seedDocsPublished();
      expect(() => ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'], bundleVersion: 999 })).toThrow();
    });

    it('固定 release 在后续删除词条后仍 immutable', async () => {
      const w = await seedDocsPublished();
      ctx.api.entry.deleteEntry(w.docs.id, 'a');
      const fixed = ctx.api.snapshot.getBundle({
        slug: 'docs',
        locales: ['zh-cn'],
        bundleVersion: 1,
      });
      const latest = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'] });
      expect(fixed.bundle.locales['zh-cn']!['a']).toBe('中A');
      expect(latest.bundle.locales['zh-cn']!['a']).toBeUndefined();
    });

    it('revert 创建新 release,旧 release 保持不变', async () => {
      const w = await seedDocsPublished();
      ctx.api.entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a',
        translations: { 'zh-cn': '中A2' },
        actorId: w.alice.id,
      });
      const entry = ctx.api.entry.getEntryByKey(w.docs.id, 'a');
      if (!entry) throw new Error('entry missing');
      ctx.api.version.revert(entry.id, 'zh-cn', 1, w.alice.id);

      const v1 = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'], bundleVersion: 1 });
      const v2 = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'], bundleVersion: 2 });
      const latest = ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['zh-cn'] });
      expect(v1.bundle.locales['zh-cn']!['a']).toBe('中A');
      expect(v2.bundle.locales['zh-cn']!['a']).toBe('中A2');
      expect(latest.bundle.locales['zh-cn']!['a']).toBe('中A');
      expect(latest.bundle.bundleVersion).toBe(3);
    });

    it('固定单语言 snapshot 响应 immutable cache header', async () => {
      await seedDocsPublished();
      ctx.api.namespace.updateNamespace('docs', { publicRead: true });
      const route = await import('~/routes/snapshot.$slug.$locale');
      const response = await route.loader({
        request: new Request('https://x/snapshot/docs/zh-cn?bundle_version=1'),
        params: { slug: 'docs', locale: 'zh-cn' },
      } as never);
      expect(response.headers.get('Cache-Control')).toContain('immutable');
      expect(response.headers.get('X-Bundle-Version')).toBe('1');
    });

    it('未启用 locale → 抛 422', async () => {
      await seedDocsPublished();
      expect(() => ctx.api.snapshot.getBundle({ slug: 'docs', locales: ['fr-fr'] })).toThrow();
    });
  });

  describe('locale manifest', () => {
    it('返回 namespace 受支持语种 + 字典元信息', async () => {
      await seedWorld(ctx);
      const m = ctx.api.snapshot.getLocaleManifest('docs');
      expect(m.namespace).toBe('docs');
      expect(m.locales.map((l) => l.code).sort()).toEqual(['en-us', 'zh-cn', 'zh-tw']);
      const zh = m.locales.find((l) => l.code === 'zh-cn')!;
      expect(zh.label).toBe('简体中文');
      expect(zh.nativeLabel).toBe('中文(简体)');
    });

    it('字典缺失 code 降级为 code 自身 / nativeLabel=null', async () => {
      await seedWorld(ctx);
      // 绕过写入守卫,直接写入一个字典外 code 模拟历史/异常数据
      const d = ctx.api.db.getDb();
      d.update(ctx.api.schema.namespaces)
        .set({ locales: JSON.stringify(['zh-cn', 'xx-yy']) })
        .where(eq(ctx.api.schema.namespaces.slug, 'docs'))
        .run();
      const m = ctx.api.snapshot.getLocaleManifest('docs');
      const xx = m.locales.find((l) => l.code === 'xx-yy')!;
      expect(xx.label).toBe('xx-yy');
      expect(xx.englishLabel).toBe('xx-yy');
      expect(xx.nativeLabel).toBeNull();
    });

    it('不存在的 namespace → 抛 404', async () => {
      await seedWorld(ctx);
      expect(() => ctx.api.snapshot.getLocaleManifest('nope')).toThrow();
    });
  });
});
