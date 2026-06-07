import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.5 跨命名空间隔离 + delete 级联(token / task)
 */
describe('namespace isolation + cascade', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('listNamespaces 仅返回本人成员关系的 ns', async () => {
    const w = await seedWorld(ctx);
    const { namespace } = ctx.api;
    expect(
      namespace
        .listNamespaces(w.alice.id)
        .map((n) => n.slug)
        .sort(),
    ).toEqual(['artx', 'docs']);
    expect(namespace.listNamespaces(w.bob.id).map((n) => n.slug)).toEqual(['docs']);
    expect(namespace.listNamespaces(w.dave.id)).toEqual([]);
  });

  it('两个 ns 词条相互隔离,key 同名互不冲突', async () => {
    const w = await seedWorld(ctx);
    const { entry } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'common',
      translations: { 'zh-cn': 'docs-中' },
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.artx.id,
      key: 'common',
      translations: { 'zh-cn': 'artx-中' },
      actorId: w.alice.id,
    });
    expect(entry.getEntryByKey(w.docs.id, 'common')!.id).not.toBe(entry.getEntryByKey(w.artx.id, 'common')!.id);
  });

  it('delete namespace 级联 entries / memberships / tokens / tasks', async () => {
    const w = await seedWorld(ctx);
    const { entry, namespace, apiToken, task, db, schema } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': '1' },
      actorId: w.alice.id,
    });
    apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 't1',
      scope: 'task',
      createdBy: w.alice.id,
    });
    task.createTask({
      namespaceId: w.docs.id,
      targetLocales: ['en-us'],
      sourceLocale: 'zh-cn',
      createdBy: w.alice.id,
    });

    namespace.deleteNamespace('docs');

    const d = db.getDb();
    expect(d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()).toBeUndefined();
    expect(d.select().from(schema.entries).where(eq(schema.entries.namespaceId, w.docs.id)).all()).toEqual([]);
    expect(d.select().from(schema.memberships).where(eq(schema.memberships.namespaceId, w.docs.id)).all()).toEqual([]);
    expect(d.select().from(schema.apiTokens).where(eq(schema.apiTokens.namespaceId, w.docs.id)).all()).toEqual([]);
    expect(
      d.select().from(schema.translationTasks).where(eq(schema.translationTasks.namespaceId, w.docs.id)).all(),
    ).toEqual([]);
    // 其他 ns 不受影响
    expect(d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()).toBeTruthy();
  });
});
