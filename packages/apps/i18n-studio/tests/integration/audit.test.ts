import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('audit events', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });

  afterEach(() => ctx.env.cleanup());

  it('entry import and token lifecycle write audit events', async () => {
    const w = await seedWorld(ctx);
    ctx.api.entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'zh-cn',
      entries: { 'audit.title': '审计' },
      actorId: w.alice.id,
    });
    const token = ctx.api.apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'readonly',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    ctx.api.apiToken.revokeApiToken(token.token.id);

    const actions = ctx.api.audit.listAuditEvents({ namespaceId: w.docs.id }).map((event) => event.action);
    expect(actions).toContain('entry.import');
    expect(actions).toContain('token.create');
    expect(actions).toContain('token.revoke');
  });

  it('publishBatch writes release audit and failed publish writes no partial audit', async () => {
    const w = await seedWorld(ctx);
    const upserted = ctx.api.entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'audit.publish',
      translations: { 'zh-cn': '待发布' },
      asDraft: true,
      actorId: w.alice.id,
    });
    ctx.api.publish.publishBatch(
      [{ entryId: upserted.entry.id, locale: 'zh-cn', version: upserted.versions['zh-cn']! }],
      w.alice.id,
    );
    expect(ctx.api.audit.listAuditEvents({ namespaceId: w.docs.id, action: 'release.publish' })).toHaveLength(1);

    expect(() =>
      ctx.api.publish.publishBatch([{ entryId: upserted.entry.id, locale: 'zh-cn', version: 999 }], w.alice.id),
    ).toThrow();
    expect(ctx.api.audit.listAuditEvents({ namespaceId: w.docs.id, action: 'release.publish' })).toHaveLength(1);
  });

  it('task results write audit event', async () => {
    const w = await seedWorld(ctx);
    const entry = ctx.api.entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'audit.task',
      translations: { 'zh-cn': '源文案' },
      actorId: w.alice.id,
    });
    const task = ctx.api.task.createTask({
      namespaceId: w.docs.id,
      targetLocales: ['en-us'],
      entryIds: [entry.entry.id],
      createdBy: w.alice.id,
    });
    ctx.api.task.claimTask(task.id, 'worker-1');
    ctx.api.task.writeResults(
      task.id,
      [{ entryId: entry.entry.id, locale: 'en-us', value: 'Source copy' }],
      w.alice.id,
    );

    const events = ctx.api.audit.listAuditEvents({ namespaceId: w.docs.id, action: 'task.results' });
    expect(events).toHaveLength(1);
    expect(events[0]!.resourceId).toBe(task.id);
  });
});
