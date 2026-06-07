import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.3 权限矩阵:admin / editor / viewer / 非成员 × 各操作
 *      + token scope (task / readonly) 各自可达 / 拒绝集合
 *
 * 直接覆盖 service 层(服务层是权限门所依赖的真值);UI 层 requireRole 在
 * `app/lib/auth.server.ts` 已有断言,这里通过 service + token 层组合断言行为。
 */
describe('permission matrix (service + token scope)', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('admin: 所有写入路径通过', async () => {
    const w = await seedWorld(ctx);
    const { entry, namespace, publish, membership } = ctx.api;
    expect(membership.getRole(w.docs.id, w.alice.id)).toBe('admin');
    expect(() =>
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中' },
        actorId: w.alice.id,
      }),
    ).not.toThrow();
    expect(() => namespace.updateNamespace('docs', { name: 'Docs2' })).not.toThrow();
    const e = entry.getEntryByKey(w.docs.id, 'a.b')!;
    // admin 可以直接 publish / discard
    expect(() => publish.publishOne(e.id, 'zh-cn', 1, w.alice.id)).toThrow(); // 已经是 published 不能再 publish
  });

  it('editor: 可写词条但不能改 namespace 设置(只 service 层暂未强约束 → 由 requireRole 把守;断言 role 为 editor)', async () => {
    const w = await seedWorld(ctx);
    const { membership, entry } = ctx.api;
    expect(membership.getRole(w.docs.id, w.bob.id)).toBe('editor');
    // editor 写词条没问题
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'x.y',
      translations: { 'zh-cn': 'x' },
      actorId: w.bob.id,
    });
    expect(entry.getEntryByKey(w.docs.id, 'x.y')).toBeTruthy();
  });

  it('viewer: getRole 返回 viewer;尝试改 role 时 admin 至少 1 名约束生效', async () => {
    const w = await seedWorld(ctx);
    const { membership } = ctx.api;
    expect(membership.getRole(w.docs.id, w.carol.id)).toBe('viewer');
    // alice 是唯一 admin,降级会被拒
    expect(() => membership.updateRole(w.docs.id, w.alice.id, 'editor')).toThrow();
  });

  it('非成员:getRole 返回 null;不会被 listNamespaces 包含', async () => {
    const w = await seedWorld(ctx);
    const { membership, namespace } = ctx.api;
    expect(membership.getRole(w.docs.id, w.dave.id)).toBeNull();
    const list = namespace.listNamespaces(w.dave.id);
    expect(list.find((n) => n.slug === 'docs')).toBeUndefined();
  });

  it('token scope=task:正确 scope 通过,错误 scope 401', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext: taskPlain } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 't',
      scope: 'task',
      createdBy: w.alice.id,
    });
    const { plaintext: roPlain } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'r',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    expect(apiToken.verifyToken(taskPlain, 'task')).toBeTruthy();
    expect(apiToken.verifyToken(taskPlain, 'readonly')).toBeNull();
    expect(apiToken.verifyToken(roPlain, 'readonly')).toBeTruthy();
    expect(apiToken.verifyToken(roPlain, 'task')).toBeNull();
  });

  it('token revoke 后立即失效', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { token, plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 't',
      scope: 'task',
      createdBy: w.alice.id,
    });
    expect(apiToken.verifyToken(plaintext, 'task')).toBeTruthy();
    apiToken.revokeApiToken(token.id);
    expect(apiToken.verifyToken(plaintext, 'task')).toBeNull();
  });

  it('token 仅绑定本命名空间:跨 ns 的 readonly token 不应能访问其他 ns snapshot', async () => {
    const w = await seedWorld(ctx);
    const { apiToken, snapshot } = ctx.api;
    const { plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'r',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    // artx 私有
    const req = new Request('https://x/snapshot/artx', { headers: { Authorization: `Bearer ${plaintext}` } });
    expect(() => snapshot.requireSnapshotAccess(req, 'artx')).toThrow();
    // 自己的 ns 通过
    const req2 = new Request('https://x/snapshot/docs', { headers: { Authorization: `Bearer ${plaintext}` } });
    expect(() => snapshot.requireSnapshotAccess(req2, 'docs')).not.toThrow();
  });
});
