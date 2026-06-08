import { setupTestDbFromTemplate, setupTestDb, type TestEnv } from './test-db';

export interface TestCtx {
  env: TestEnv;
  // dynamic 引入的服务句柄,避免每个测试文件重复写 import 列表
  api: {
    auth: typeof import('~/lib/auth.server');
    namespace: typeof import('~/lib/services/namespace.server');
    membership: typeof import('~/lib/services/membership.server');
    entry: typeof import('~/lib/services/entry.server');
    publish: typeof import('~/lib/services/publish.server');
    version: typeof import('~/lib/services/version.server');
    query: typeof import('~/lib/services/query.server');
    sync: typeof import('~/lib/services/sync.server');
    task: typeof import('~/lib/services/task.server');
    exporter: typeof import('~/lib/services/export.server');
    snapshot: typeof import('~/lib/services/snapshot.server');
    apiToken: typeof import('~/lib/api-token.server');
    db: typeof import('~/lib/db.server');
    schema: typeof import('~/db/schema');
  };
}

export async function bootstrap(env: TestEnv): Promise<TestCtx> {
  const [
    auth,
    namespace,
    membership,
    entry,
    publish,
    version,
    query,
    sync,
    task,
    exporter,
    snapshot,
    apiToken,
    db,
    schema,
  ] = await Promise.all([
    import('~/lib/auth.server'),
    import('~/lib/services/namespace.server'),
    import('~/lib/services/membership.server'),
    import('~/lib/services/entry.server'),
    import('~/lib/services/publish.server'),
    import('~/lib/services/version.server'),
    import('~/lib/services/query.server'),
    import('~/lib/services/sync.server'),
    import('~/lib/services/task.server'),
    import('~/lib/services/export.server'),
    import('~/lib/services/snapshot.server'),
    import('~/lib/api-token.server'),
    import('~/lib/db.server'),
    import('~/db/schema'),
  ]);
  return {
    env,
    api: {
      auth,
      namespace,
      membership,
      entry,
      publish,
      version,
      query,
      sync,
      task,
      exporter,
      snapshot,
      apiToken,
      db,
      schema,
    },
  };
}

export interface SeededWorld {
  alice: { id: string; email: string };
  bob: { id: string; email: string };
  carol: { id: string; email: string };
  dave: { id: string; email: string };
  docs: { id: string; slug: 'docs' };
  artx: { id: string; slug: 'artx' };
}

/**
 * 初始化一组通用测试用户与命名空间,
 * 用于多文件共享:
 * - users: alice(超管/docs admin), bob(docs editor), carol(docs viewer), dave(无成员关系)
 * - namespaces: docs(zh-cn,zh-tw,en-us), artx(zh-cn,en-us) — alice 是两边的 admin
 */
export async function seedWorld(ctx: TestCtx): Promise<SeededWorld> {
  const { auth, namespace, membership } = ctx.api;
  const alice = await auth.registerUser('alice@x.com', 'pwd', 'Alice');
  const bob = await auth.registerUser('bob@x.com', 'pwd', 'Bob');
  const carol = await auth.registerUser('carol@x.com', 'pwd', 'Carol');
  const dave = await auth.registerUser('dave@x.com', 'pwd', 'Dave');
  const docs = namespace.createNamespace({ slug: 'docs', name: 'Docs', createdBy: alice.id });
  const artx = namespace.createNamespace({
    slug: 'artx',
    name: 'Artx',
    locales: ['zh-cn', 'en-us'],
    defaultLocale: 'zh-cn',
    createdBy: alice.id,
  });
  membership.inviteByEmail(docs.id, 'bob@x.com', 'editor');
  membership.inviteByEmail(docs.id, 'carol@x.com', 'viewer');
  return {
    alice: { id: alice.id, email: alice.email },
    bob: { id: bob.id, email: bob.email },
    carol: { id: carol.id, email: carol.email },
    dave: { id: dave.id, email: dave.email },
    docs: { id: docs.id, slug: 'docs' },
    artx: { id: artx.id, slug: 'artx' },
  };
}

export { setupTestDbFromTemplate, setupTestDb };
