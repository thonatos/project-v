import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

/**
 * write scope token + import 接口鉴权测试(openspec: ui-i18n-sync / 决策 9)。
 * 覆盖:wr_ 前缀生成、verifyToken('write') 命中、import 接受有效 write token、
 * 拒绝 readonly / 已吊销 / 跨 namespace token。
 */
describe('write token scope', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('write token 使用 wr_ 前缀', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext, token } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'writer',
      scope: 'write',
      createdBy: w.alice.id,
    });
    expect(plaintext.startsWith('wr_')).toBe(true);
    expect(token.scope).toBe('write');
  });

  it('verifyToken: write token 仅命中 write scope', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'writer',
      scope: 'write',
      createdBy: w.alice.id,
    });
    expect(apiToken.verifyToken(plaintext, 'write')).toBeTruthy();
    expect(apiToken.verifyToken(plaintext, 'readonly')).toBeNull();
    expect(apiToken.verifyToken(plaintext, 'task')).toBeNull();
    const v = apiToken.verifyToken(plaintext, 'write');
    expect(v?.namespaceSlug).toBe('docs');
  });

  it('import: 接受有效 write token,文案写入', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'writer',
      scope: 'write',
      createdBy: w.alice.id,
    });
    const { action } = await import('~/routes/api.namespaces.$slug.import');
    const request = new Request('https://x/api/namespaces/docs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ locale: 'zh-cn', entries: { 'common.hello': '你好' } }),
    });
    const res = await action({ request, params: { slug: 'docs' }, context: {} } as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; imported: number };
    expect(json.ok).toBe(true);
    expect(json.imported).toBe(1);
    const entry = ctx.api.entry.getEntryByKey(w.docs.id, 'common.hello');
    expect(entry).toBeTruthy();
  });

  it('import: 拒绝 readonly token(401)', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'ro',
      scope: 'readonly',
      createdBy: w.alice.id,
    });
    const { action } = await import('~/routes/api.namespaces.$slug.import');
    const request = new Request('https://x/api/namespaces/docs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ locale: 'zh-cn', entries: { 'common.hello': '你好' } }),
    });
    const res = await action({ request, params: { slug: 'docs' }, context: {} } as never);
    expect(res.status).toBe(401);
    expect(ctx.api.entry.getEntryByKey(w.docs.id, 'common.hello')).toBeFalsy();
  });

  it('import: 拒绝已吊销的 write token(401)', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    const { plaintext, token } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'writer',
      scope: 'write',
      createdBy: w.alice.id,
    });
    apiToken.revokeApiToken(token.id);
    const { action } = await import('~/routes/api.namespaces.$slug.import');
    const request = new Request('https://x/api/namespaces/docs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ locale: 'zh-cn', entries: { 'common.hello': '你好' } }),
    });
    const res = await action({ request, params: { slug: 'docs' }, context: {} } as never);
    expect(res.status).toBe(401);
  });

  it('import: 拒绝跨 namespace 的 write token(401)', async () => {
    const w = await seedWorld(ctx);
    const { apiToken } = ctx.api;
    // token 绑定到 docs,却拿去写 artx
    const { plaintext } = apiToken.createApiToken({
      namespaceId: w.docs.id,
      name: 'writer',
      scope: 'write',
      createdBy: w.alice.id,
    });
    const { action } = await import('~/routes/api.namespaces.$slug.import');
    const request = new Request('https://x/api/namespaces/artx/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ locale: 'zh-cn', entries: { 'common.hello': '你好' } }),
    });
    const res = await action({ request, params: { slug: 'artx' }, context: {} } as never);
    expect(res.status).toBe(401);
    expect(ctx.api.entry.getEntryByKey(w.artx.id, 'common.hello')).toBeFalsy();
  });
});
