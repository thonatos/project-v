import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';
import * as schema from '~/db/schema';

describe('namespace', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  describe('crud + isolation', () => {
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
      const { entry, namespace, apiToken, task, db, schema: s } = ctx.api;
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
      expect(d.select().from(s.namespaces).where(eq(s.namespaces.id, w.docs.id)).get()).toBeUndefined();
      expect(d.select().from(s.entries).where(eq(s.entries.namespaceId, w.docs.id)).all()).toEqual([]);
      expect(d.select().from(s.memberships).where(eq(s.memberships.namespaceId, w.docs.id)).all()).toEqual([]);
      expect(d.select().from(s.apiTokens).where(eq(s.apiTokens.namespaceId, w.docs.id)).all()).toEqual([]);
      expect(d.select().from(s.translationTasks).where(eq(s.translationTasks.namespaceId, w.docs.id)).all()).toEqual(
        [],
      );
      expect(d.select().from(s.namespaces).where(eq(s.namespaces.id, w.artx.id)).get()).toBeTruthy();
    });
  });

  describe('cross-service interaction', () => {
    it('creates ns + upserts entry + publishes; bundleVersion increments once', async () => {
      const { auth, namespace, entry, db, schema: s } = ctx.api;
      const user = await auth.registerUser('alice@x.com', 'password123', 'Alice');
      const ns = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
      expect(ns.bundleVersion).toBe(0);

      entry.upsertEntry({
        namespaceId: ns.id,
        key: 'home.title',
        translations: { 'zh-cn': '首页', 'en-us': 'Home' },
        asDraft: false,
        actorId: user.id,
      });

      const after = db.getDb().select().from(s.namespaces).where(eq(s.namespaces.id, ns.id)).get()!;
      expect(after.bundleVersion).toBe(1);

      expect(entry.getEntryByKey(ns.id, 'home.title')).toBeTruthy();
    });

    it('as_draft does not bump bundleVersion', async () => {
      const { auth, namespace, entry, db, schema: s } = ctx.api;
      const user = await auth.registerUser('alice@x.com', 'password123', 'Alice');
      const ns = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
      entry.upsertEntry({
        namespaceId: ns.id,
        key: 'home.title',
        translations: { 'zh-cn': '首页' },
        asDraft: true,
        actorId: user.id,
      });
      const after = db.getDb().select().from(s.namespaces).where(eq(s.namespaces.id, ns.id)).get()!;
      expect(after.bundleVersion).toBe(0);
    });

    it('publish from draft and revert', async () => {
      const { auth, namespace, entry, publish, version: ver } = ctx.api;
      const user = await auth.registerUser('alice@x.com', 'password123', 'Alice');
      const ns = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
      entry.upsertEntry({
        namespaceId: ns.id,
        key: 'a.b',
        translations: { 'zh-cn': 'v1' },
        asDraft: true,
        actorId: user.id,
      });
      const e = entry.getEntryByKey(ns.id, 'a.b')!;
      let history = ver.listVersions(e.id, 'zh-cn');
      expect(history.versions[0]?.status).toBe('draft');

      publish.publishOne(e.id, 'zh-cn', 1, user.id);
      history = ver.listVersions(e.id, 'zh-cn');
      expect(history.currentPublishedVersion).toBe(1);

      entry.upsertEntry({
        namespaceId: ns.id,
        key: 'a.b',
        translations: { 'zh-cn': 'v2' },
        asDraft: false,
        actorId: user.id,
      });
      history = ver.listVersions(e.id, 'zh-cn');
      expect(history.currentPublishedVersion).toBe(2);

      const r = ver.revert(e.id, 'zh-cn', 1, user.id);
      expect(r.newVersion).toBe(3);
      history = ver.listVersions(e.id, 'zh-cn');
      expect(history.versions[0]?.value).toBe('v1');
      expect(history.versions[0]?.source).toBe('revert');

      expect(() => publish.discard(e.id, 'zh-cn', 999, user.id)).toThrow();
    });

    it('keeps at least one admin', async () => {
      const { auth, namespace, membership } = ctx.api;
      const user = await auth.registerUser('alice@x.com', 'password123', 'Alice');
      const ns = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
      expect(() => membership.updateRole(ns.id, user.id, 'editor')).toThrow();
    });

    it('rejects removing locale with published refs', async () => {
      const { auth, namespace, entry } = ctx.api;
      const user = await auth.registerUser('alice@x.com', 'password123', 'Alice');
      const ns = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: user.id });
      entry.upsertEntry({
        namespaceId: ns.id,
        key: 'a',
        translations: { 'en-us': 'A' },
        actorId: user.id,
      });
      expect(() =>
        namespace.updateNamespace('docs', { locales: ['zh-cn', 'zh-tw'], defaultLocale: 'zh-cn' }),
      ).toThrow();
    });
  });

  describe('bundle_version concurrency', () => {
    it('串行两次 published 写入 → +2', async () => {
      const w = await seedWorld(ctx);
      const { entry, db } = ctx.api;
      const d = db.getDb();
      const before = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a',
        translations: { 'zh-cn': '1' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'b',
        translations: { 'zh-cn': '1' },
        actorId: w.alice.id,
      });
      const after = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion + 2);
    });

    it('两个独立连接的原子 +1 不丢失更新', async () => {
      const w = await seedWorld(ctx);
      const { db } = ctx.api;
      const d = db.getDb();
      const before = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;

      const a = new Database(ctx.env.dbFile);
      const b = new Database(ctx.env.dbFile);
      a.pragma('busy_timeout = 5000');
      b.pragma('busy_timeout = 5000');
      const stmtA = a.prepare('UPDATE namespaces SET bundle_version = bundle_version + 1 WHERE id = ?');
      const stmtB = b.prepare('UPDATE namespaces SET bundle_version = bundle_version + 1 WHERE id = ?');
      stmtA.run(w.docs.id);
      stmtB.run(w.docs.id);
      a.close();
      b.close();

      const after = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion + 2);
    });
  });

  describe('locale dictionary integration', () => {
    it('createNamespace 不传 locales → 取字典前 3 个 enabled', async () => {
      const { auth, namespace } = ctx.api;
      const alice = await auth.registerUser('z@x.com', 'pwd', 'Z');
      const ns = namespace.createNamespace({ slug: 'def', name: 'Default', createdBy: alice.id });
      const arr = JSON.parse(ns.locales) as string[];
      expect(arr).toEqual(['zh-cn', 'zh-tw', 'en-us']);
      expect(ns.defaultLocale).toBe('zh-cn');
    });

    it('createNamespace locales 含字典外 → 抛 locale_not_found', async () => {
      const { auth, namespace } = ctx.api;
      const alice = await auth.registerUser('z@x.com', 'pwd', 'Z');
      let caught: Response | null = null;
      try {
        namespace.createNamespace({ slug: 'bad', name: 'Bad', locales: ['xx-yy'], createdBy: alice.id });
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string };
      expect(body.code).toBe('locale_not_found');
    });

    it('createNamespace locales 含 disabled → 抛 locale_disabled', async () => {
      const { auth, namespace } = ctx.api;
      const locale = await import('~/lib/services/locale.server');
      const alice = await auth.registerUser('z@x.com', 'pwd', 'Z');
      locale.setEnabled('de-de', false);
      let caught: Response | null = null;
      try {
        namespace.createNamespace({ slug: 'bad', name: 'Bad', locales: ['de-de'], createdBy: alice.id });
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string };
      expect(body.code).toBe('locale_disabled');
    });

    it('updateNamespace locales 含字典外 → 抛 locale_not_found', async () => {
      const w = await seedWorld(ctx);
      let caught: Response | null = null;
      try {
        ctx.api.namespace.updateNamespace('docs', { locales: ['zh-cn', 'xx-yy'] });
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string };
      expect(body.code).toBe('locale_not_found');
    });
  });
});
