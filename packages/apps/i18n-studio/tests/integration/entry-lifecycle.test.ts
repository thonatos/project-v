import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('entry lifecycle', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  describe('importFlat', () => {
    it('成功路径:写入 N 条 published,bundleVersion +1(批共享一次)', async () => {
      const w = await seedWorld(ctx);
      const { entry, db, schema } = ctx.api;
      const r = entry.importFlat({
        namespaceId: w.docs.id,
        locale: 'zh-cn',
        entries: { 'a.b': '1', 'a.c': '2', d: '3' },
        actorId: w.alice.id,
      });
      expect(r.ok).toBe(true);
      expect(r.imported).toBe(3);
      expect(r.total).toBe(3);
      const ns = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      expect(ns.bundleVersion).toBe(1);
    });

    it('预校验失败:任一非法 key 整批回滚,bundleVersion 不变', async () => {
      const w = await seedWorld(ctx);
      const { entry, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      const r = entry.importFlat({
        namespaceId: w.docs.id,
        locale: 'zh-cn',
        entries: { 'a.b': '1', '': 'x', '.bad.': 'y' },
        actorId: w.alice.id,
      });
      expect(r.ok).toBe(false);
      expect(r.imported).toBe(0);
      expect(r.errors.length).toBeGreaterThan(0);
      const rows = db.getDb().select().from(schema.entries).where(eq(schema.entries.namespaceId, w.docs.id)).all();
      expect(rows.length).toBe(0);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion);
    });

    it('未启用的 locale → ok:false', async () => {
      const w = await seedWorld(ctx);
      const r = ctx.api.entry.importFlat({
        namespaceId: w.docs.id,
        locale: 'fr-fr',
        entries: { a: 'b' },
        actorId: w.alice.id,
      });
      expect(r.ok).toBe(false);
      expect(r.errors[0]?.reason).toMatch(/locale 未启用/);
    });

    it('超过 10000 条上限:整批拒绝', async () => {
      const w = await seedWorld(ctx);
      const big: Record<string, string> = {};
      for (let i = 0; i < 10001; i++) big[`k.${i}`] = String(i);
      const r = ctx.api.entry.importFlat({
        namespaceId: w.docs.id,
        locale: 'zh-cn',
        entries: big,
        actorId: w.alice.id,
      });
      expect(r.ok).toBe(false);
      expect(r.imported).toBe(0);
      expect(r.errors[0]?.reason).toMatch(/上限/);
    });

    it('as_draft=true:写入但 bundleVersion 不递增,translation 行为 draft', async () => {
      const w = await seedWorld(ctx);
      const { entry, version: ver, db, schema } = ctx.api;
      entry.importFlat({
        namespaceId: w.docs.id,
        locale: 'zh-cn',
        entries: { 'a.b': '1', c: '2' },
        asDraft: true,
        actorId: w.alice.id,
      });
      const ns = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      expect(ns.bundleVersion).toBe(0);
      const e = entry.getEntryByKey(w.docs.id, 'a.b')!;
      const tv = db
        .getDb()
        .select()
        .from(schema.translationVersions)
        .where(and(eq(schema.translationVersions.entryId, e.id), eq(schema.translationVersions.locale, 'zh-cn')))
        .all();
      expect(tv.every((r) => r.status === 'draft')).toBe(true);
      const h = ver.listVersions(e.id, 'zh-cn');
      expect(h.versions[0]?.status).toBe('draft');
    });
  });

  describe('publish/discard', () => {
    async function makeDrafts(): Promise<{ entryId: string; aliceId: string; nsId: string }> {
      const w = await seedWorld(ctx);
      const { entry } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a',
        translations: { 'zh-cn': 'd1', 'en-us': 'd1' },
        asDraft: true,
        actorId: w.alice.id,
      });
      const e = entry.getEntryByKey(w.docs.id, 'a')!;
      return { entryId: e.id, aliceId: w.alice.id, nsId: w.docs.id };
    }

    it('单条 publish:status: draft → published,bundleVersion+1', async () => {
      const { entryId, aliceId, nsId } = await makeDrafts();
      const { publish, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      publish.publishOne(entryId, 'zh-cn', 1, aliceId);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion + 1);
    });

    it('批量 publish:N 条共用一次 bundle_version+1', async () => {
      const { entryId, aliceId, nsId } = await makeDrafts();
      const { publish, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      const r = publish.publishBatch(
        [
          { entryId, locale: 'zh-cn', version: 1 },
          { entryId, locale: 'en-us', version: 1 },
        ],
        aliceId,
      );
      expect(r.published).toBe(2);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion + 1);
    });

    it('不存在的 draft → 抛 404 Response', async () => {
      const { entryId, aliceId } = await makeDrafts();
      expect(() => ctx.api.publish.publishOne(entryId, 'zh-cn', 999, aliceId)).toThrow();
    });

    it('已 discarded 的版本不可 publish', async () => {
      const { entryId, aliceId } = await makeDrafts();
      const { publish } = ctx.api;
      publish.discard(entryId, 'zh-cn', 1, aliceId);
      expect(() => publish.publishOne(entryId, 'zh-cn', 1, aliceId)).toThrow();
    });

    it('discard 仅作用于 draft;对 published 报错', async () => {
      const { entryId, aliceId } = await makeDrafts();
      const { publish } = ctx.api;
      publish.publishOne(entryId, 'zh-cn', 1, aliceId);
      expect(() => publish.discard(entryId, 'zh-cn', 1, aliceId)).toThrow();
    });

    it('discard 不递增 bundle_version', async () => {
      const { entryId, aliceId, nsId } = await makeDrafts();
      const { publish, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      publish.discard(entryId, 'zh-cn', 1, aliceId);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion);
    });
  });

  describe('query views', () => {
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
        key: 'a.c',
        translations: { 'en-us': 'EN-AC-d' },
        asDraft: true,
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'x.y',
        translations: { 'zh-cn': '中XY', 'en-us': 'EN-XY' },
        actorId: w.alice.id,
      });
      return w;
    }

    it('view=all:返回每个 entry 的全部 locale', async () => {
      const w = await seed();
      const r = ctx.api.query.listEntries(w.docs.id, { view: 'all' });
      expect(r.entries).toBeDefined();
      expect(r.entries!.length).toBe(3);
      const ab = r.entries!.find((e) => e.key === 'a.b')!;
      expect(Object.keys(ab.translations).sort()).toEqual(['en-us', 'zh-cn', 'zh-tw']);
    });

    it('locale 子集:仅返回 zh-cn / en-us', async () => {
      const w = await seed();
      const r = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn', 'en-us'] });
      const ab = r.entries!.find((e) => e.key === 'a.b')!;
      expect(Object.keys(ab.translations).sort()).toEqual(['en-us', 'zh-cn']);
    });

    it('group=locale:按 locale 桶组织;与 group=key 在 published 集合上一致', async () => {
      const w = await seed();
      const byKey = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn'], group: 'key' });
      const byLocale = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn'], group: 'locale' });
      const fromKey: Record<string, string> = {};
      for (const e of byKey.entries!) {
        const cell = e.translations['zh-cn'];
        if (cell && !cell.missing) fromKey[e.key] = cell.value;
      }
      const fromLocale: Record<string, string> = {};
      for (const item of byLocale.locales!['zh-cn']!) {
        if (!item.missing) fromLocale[item.key] = item.value;
      }
      expect(fromKey).toEqual(fromLocale);
    });

    it('include=both:有 draft 时同时给 published 和 draft', async () => {
      const w = await seed();
      const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'both' });
      const ac = r.entries!.find((e) => e.key === 'a.c')!;
      expect(ac.translations['en-us']?.missing).toBeFalsy();
      expect(ac.translations['en-us']?.version).toBeNull();
      expect(ac.translations['en-us']?.draft?.value).toBe('EN-AC-d');
      expect(ac.translations['zh-cn']?.value).toBe('中AC');
      expect(ac.translations['zh-cn']?.draft).toBeUndefined();
    });

    it('status=draft:仅返回包含任意 draft 的 entry', async () => {
      const w = await seed();
      const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'both', status: 'draft' });
      expect(r.entries!.map((e) => e.key)).toEqual(['a.c']);
    });

    it('include=draft:返回的 cell 取自 draft;无 draft 标 missing', async () => {
      const w = await seed();
      const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'draft' });
      const ac = r.entries!.find((e) => e.key === 'a.c')!;
      expect(ac.translations['en-us']?.value).toBe('EN-AC-d');
      const ab = r.entries!.find((e) => e.key === 'a.b')!;
      expect(ab.translations['en-us']?.missing).toBe(true);
    });

    it('at_version 快照:返回某 version 之前的 published', async () => {
      const w = await seed();
      const { entry, query } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中AB-v2' },
        actorId: w.alice.id,
      });
      const r = query.listEntries(w.docs.id, { view: 'all', atVersion: 1 });
      const ab = r.entries!.find((e) => e.key === 'a.b')!;
      expect(ab.translations['zh-cn']?.value).toBe('中AB');
      expect(ab.translations['zh-cn']?.version).toBe(1);
    });

    it('分页 cursor:pageSize 受限,nextCursor 可继续', async () => {
      const w = await seed();
      const r1 = ctx.api.query.listEntries(w.docs.id, { view: 'all', pageSize: 2 });
      expect(r1.entries!.length).toBe(2);
      expect(r1.page.nextCursor).not.toBeNull();
      const r2 = ctx.api.query.listEntries(w.docs.id, {
        view: 'all',
        pageSize: 2,
        cursor: r1.page.nextCursor,
      });
      expect(r2.entries!.length).toBe(1);
      expect(r2.page.nextCursor).toBeNull();
    });

    it('view=all 与 locale 互斥:同时给 → 报错', async () => {
      const w = await seed();
      expect(() => ctx.api.query.listEntries(w.docs.id, { view: 'all', locale: ['zh-cn'] })).toThrow();
    });
  });
});
