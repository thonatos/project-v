import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.9 跨空间同步:
 *  - strategy: skip / overwrite / fill_missing
 *  - dry_run 不写入
 *  - entry_ids 白名单
 *  - auto_publish=true 整次共用一次 bundle_version+1
 *  - 非启用 locale → 422
 */
describe('cross-namespace sync', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  async function seed() {
    const w = await seedWorld(ctx);
    const { entry } = ctx.api;
    // docs 源:a.b zh/en、a.c zh
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
    // artx 目标已经有 a.b zh-cn 的 published(用于 strategy 区分)
    entry.upsertEntry({
      namespaceId: w.artx.id,
      key: 'a.b',
      translations: { 'zh-cn': '原-AB' },
      actorId: w.alice.id,
    });
    return w;
  }

  it('dry_run:返回计划但不写入', async () => {
    const w = await seed();
    const { sync, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    const plan = sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      locales: ['zh-cn'],
      strategy: 'overwrite',
      dryRun: true,
      actorId: w.alice.id,
    }) as { toCreate: number; toUpdate: number; toSkip: number };
    expect(plan.toCreate + plan.toUpdate + plan.toSkip).toBeGreaterThan(0);
    // bundleVersion 不变
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion);
  });

  it('strategy=overwrite + auto_publish:覆盖既有 published,共用一次 bundle_version+1', async () => {
    const w = await seed();
    const { sync, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    const r = sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      locales: ['zh-cn'],
      strategy: 'overwrite',
      autoPublish: true,
      actorId: w.alice.id,
    }) as { created: number; updated: number; skipped: number; bundleVersion?: number };
    expect(r.updated).toBeGreaterThanOrEqual(1);
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion + 1);
  });

  it('strategy=fill_missing:仅在 target 没有 published 时写入', async () => {
    const w = await seed();
    const { sync, entry, db, schema } = ctx.api;
    const r = sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      locales: ['zh-cn'],
      strategy: 'fill_missing',
      autoPublish: true,
      actorId: w.alice.id,
    }) as { created: number; updated: number; skipped: number };
    // a.b 有 published → skip;a.c 无 → create
    expect(r.created).toBe(1);
    expect(r.skipped).toBeGreaterThanOrEqual(1);
    expect(r.updated).toBe(0);
    // a.b 的 zh-cn 仍是原值
    const ab = entry.getEntryByKey(w.artx.id, 'a.b')!;
    const t = db.getDb().select().from(schema.translations).where(eq(schema.translations.entryId, ab.id)).all();
    expect(t.find((x) => x.locale === 'zh-cn')?.value).toBe('原-AB');
  });

  it('strategy=skip:target 存在 entry → 整 entry skip', async () => {
    const w = await seed();
    const { sync, entry } = ctx.api;
    sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      locales: ['zh-cn'],
      strategy: 'skip',
      autoPublish: true,
      actorId: w.alice.id,
    }) as unknown;
    // a.b 跳过(target 已存在),a.c 不存在 → create
    const ac = entry.getEntryByKey(w.artx.id, 'a.c');
    expect(ac).toBeTruthy();
    // a.b 仍是原值
    expect(entry.getEntryByKey(w.artx.id, 'a.b')!.id).toBeTruthy();
  });

  it('entry_ids 白名单:仅同步指定 id,不在 source 内的 id → 422', async () => {
    const w = await seed();
    const { sync, entry } = ctx.api;
    const ab = entry.getEntryByKey(w.docs.id, 'a.b')!;
    const r = sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      entryIds: [ab.id],
      locales: ['zh-cn'],
      strategy: 'overwrite',
      autoPublish: true,
      actorId: w.alice.id,
    }) as { created: number; updated: number; skipped: number };
    // 只处理 a.b
    expect(r.created + r.updated).toBe(1);
    expect(() =>
      sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        entryIds: ['not-in-docs'],
        locales: ['zh-cn'],
        strategy: 'overwrite',
        actorId: w.alice.id,
      }),
    ).toThrow();
  });

  it('autoPublish=false:写入 draft,不递增 bundle_version', async () => {
    const w = await seed();
    const { sync, entry, version: ver, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    sync.syncSpaces({
      sourceSlug: 'docs',
      targetSlug: 'artx',
      locales: ['zh-cn'],
      strategy: 'overwrite',
      autoPublish: false,
      actorId: w.alice.id,
    });
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion);
    // a.c 落 draft
    const ac = entry.getEntryByKey(w.artx.id, 'a.c')!;
    const h = ver.listVersions(ac.id, 'zh-cn');
    expect(h.versions[0]?.status).toBe('draft');
    expect(h.versions[0]?.source).toBe('sync');
  });

  it('locale 未在目标 ns 启用 → 422', async () => {
    const w = await seed();
    const { sync } = ctx.api;
    expect(() =>
      sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-tw'], // artx 未启用
        strategy: 'overwrite',
        actorId: w.alice.id,
      }),
    ).toThrow();
  });
});
