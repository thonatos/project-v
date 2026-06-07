import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, bootstrap, type TestCtx } from './helpers';

/**
 * 8.15 进程内 E2E 冒烟:
 *  注册 → 建 ns → 批量导入 zh-cn(published) → 生成 task token → 外部 worker
 *  pull payload + 回写 en-us(draft) → admin publish → 创建 readonly token →
 *  /snapshot 取最终 bundle。覆盖关键 API 在 service 层的端到端贯通。
 */
describe('e2e smoke (in-process)', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('全链路:注册 → 导入 → task 翻译回写 → publish → snapshot 客户端可消费', async () => {
    const { auth, namespace, entry, task, publish, snapshot, apiToken } = ctx.api;

    const alice = await auth.registerUser('alice@x.com', 'pwd', 'Alice');
    const ns = namespace.createNamespace({
      slug: 'docs',
      name: 'Docs',
      createdBy: alice.id,
    });

    // 批量导入 zh-cn 词条(published)
    const ir = entry.importFlat({
      namespaceId: ns.id,
      locale: 'zh-cn',
      entries: { 'home.title': '首页', 'home.subtitle': '欢迎' },
      actorId: alice.id,
    });
    expect(ir.ok).toBe(true);
    expect(ir.imported).toBe(2);

    // 创建翻译任务 + task token
    const t = task.createTask({
      namespaceId: ns.id,
      filter: { prefix: 'home.' },
      targetLocales: ['en-us'],
      sourceLocale: 'zh-cn',
      createdBy: alice.id,
    });
    expect(t.total).toBe(2);
    const { plaintext: taskToken } = apiToken.createApiToken({
      namespaceId: ns.id,
      name: 'worker',
      scope: 'task',
      createdBy: alice.id,
    });
    expect(apiToken.verifyToken(taskToken, 'task')?.namespaceSlug).toBe('docs');

    // worker:拉取 payload + claim + 回写 draft
    const payload = task.getPayload(t.id);
    expect(payload['home.title']).toBe('首页');
    const claimed = task.claimTask(t.id, 'worker-1');
    const results = claimed.items.map((i) => ({
      entryId: i.entryId,
      locale: 'en-us',
      value: i.key === 'home.title' ? 'Home' : 'Welcome',
    }));
    expect(task.writeResults(t.id, results, alice.id).applied).toBe(2);
    task.completeTask(t.id);

    // admin 批量 publish
    const eTitle = entry.getEntryByKey(ns.id, 'home.title')!;
    const eSub = entry.getEntryByKey(ns.id, 'home.subtitle')!;
    const pr = publish.publishBatch(
      [
        { entryId: eTitle.id, locale: 'en-us', version: 1 },
        { entryId: eSub.id, locale: 'en-us', version: 1 },
      ],
      alice.id,
    );
    expect(pr.published).toBe(2);

    // 客户端用 readonly token 取 snapshot
    const { plaintext: roToken } = apiToken.createApiToken({
      namespaceId: ns.id,
      name: 'web',
      scope: 'readonly',
      createdBy: alice.id,
    });
    const req = new Request('https://x/snapshot/docs', {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    snapshot.requireSnapshotAccess(req, 'docs');
    const { bundle, meta } = snapshot.getBundle({ slug: 'docs', locales: ['zh-cn', 'en-us'] });
    expect(bundle.locales['zh-cn']!['home.title']).toBe('首页');
    expect(bundle.locales['en-us']!['home.title']).toBe('Home');
    expect(bundle.locales['en-us']!['home.subtitle']).toBe('Welcome');
    expect(meta.bundleVersion).toBeGreaterThanOrEqual(2);
  });
});
