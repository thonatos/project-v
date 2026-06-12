import { setupTestDbFromTemplate, setupTestDb, type TestEnv } from './test-db';
import { and, eq, sql } from 'drizzle-orm';

import { newId, nowMs } from '~/lib/id.server';
import type { AuditEvent, NamespaceInvitation, QualityIssue, Release, TranslationTaskLog } from '~/db/schema';

export interface TestCtx {
  env: TestEnv;
  // dynamic 引入的服务句柄,避免每个测试文件重复写 import 列表
  api: {
    auth: typeof import('~/lib/auth.server');
    namespace: typeof import('~/lib/services/namespace.server');
    membership: typeof import('~/lib/services/membership.server');
    invitation: typeof import('~/lib/services/invitation.server');
    entry: typeof import('~/lib/services/entry.server');
    publish: typeof import('~/lib/services/publish.server');
    version: typeof import('~/lib/services/version.server');
    query: typeof import('~/lib/services/query.server');
    audit: typeof import('~/lib/services/audit.server');
    quality: typeof import('~/lib/services/quality.server');
    release: typeof import('~/lib/services/release.server');
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
    invitation,
    entry,
    publish,
    version,
    query,
    audit,
    quality,
    release,
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
    import('~/lib/services/invitation.server'),
    import('~/lib/services/entry.server'),
    import('~/lib/services/publish.server'),
    import('~/lib/services/version.server'),
    import('~/lib/services/query.server'),
    import('~/lib/services/audit.server'),
    import('~/lib/services/quality.server'),
    import('~/lib/services/release.server'),
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
      invitation,
      entry,
      publish,
      version,
      query,
      audit,
      quality,
      release,
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

export interface SeedReleaseResult {
  release: Release;
  itemCount: number;
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

export function seedReleaseManifest(
  ctx: TestCtx,
  input: { namespaceId: string; actorId: string; bundleVersion?: number; source?: Release['source'] },
): SeedReleaseResult {
  const db = ctx.api.db.getDb();
  const { entries, namespaces, releases, releaseItems, translationVersions, translations } = ctx.api.schema;
  const ns = db.select().from(namespaces).where(eq(namespaces.id, input.namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const bundleVersion = input.bundleVersion ?? (ns.bundleVersion > 0 ? ns.bundleVersion : 1);
  const now = nowMs();

  type PublishedRow = {
    entryId: string;
    key: string;
    locale: string;
    translationVersionId: string;
    translationVersionNumber: number;
    value: string;
  };

  return db.transaction((tx) => {
    if (ns.bundleVersion === 0 && bundleVersion > 0) {
      tx.update(namespaces).set({ bundleVersion, updatedAt: now }).where(eq(namespaces.id, ns.id)).run();
    }

    const release: Release = {
      id: newId(),
      namespaceId: ns.id,
      bundleVersion,
      status: 'published',
      source: input.source ?? 'migration',
      note: 'test release manifest',
      createdBy: input.actorId,
      createdAt: now,
      publishedAt: now,
    };
    tx.insert(releases).values(release).run();

    const rows = tx
      .select({
        entryId: entries.id,
        key: entries.key,
        locale: translations.locale,
        translationVersionId: translationVersions.id,
        translationVersionNumber: translationVersions.version,
        value: translationVersions.value,
      })
      .from(translations)
      .innerJoin(entries, eq(entries.id, translations.entryId))
      .innerJoin(
        translationVersions,
        and(
          eq(translationVersions.entryId, translations.entryId),
          eq(translationVersions.locale, translations.locale),
          eq(translationVersions.version, translations.publishedVersion),
        ),
      )
      .where(and(eq(entries.namespaceId, ns.id), sql`${translations.publishedVersion} IS NOT NULL`))
      .all() as PublishedRow[];

    for (const row of rows) {
      tx.insert(releaseItems)
        .values({
          id: newId(),
          releaseId: release.id,
          entryId: row.entryId,
          locale: row.locale,
          key: row.key,
          value: row.value,
          translationVersionId: row.translationVersionId,
          translationVersionNumber: row.translationVersionNumber,
        })
        .run();
    }

    return { release, itemCount: rows.length };
  });
}

export function seedAuditEvent(
  ctx: TestCtx,
  input: Partial<AuditEvent> & { action: string; resourceType: string },
): AuditEvent {
  const now = nowMs();
  const row: AuditEvent = {
    id: input.id ?? newId(),
    namespaceId: input.namespaceId ?? null,
    actorId: input.actorId ?? null,
    actorType: input.actorType ?? 'user',
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    requestId: input.requestId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? now,
  };
  ctx.api.db.getDb().insert(ctx.api.schema.auditEvents).values(row).run();
  return row;
}

export function seedInvitation(
  ctx: TestCtx,
  input: {
    namespaceId: string;
    email: string;
    role?: NamespaceInvitation['role'];
    invitedBy: string;
    tokenHash?: string;
    status?: NamespaceInvitation['status'];
    expiresAt?: number;
  },
): NamespaceInvitation {
  const now = nowMs();
  const row: NamespaceInvitation = {
    id: newId(),
    namespaceId: input.namespaceId,
    email: input.email.toLowerCase().trim(),
    role: input.role ?? 'editor',
    tokenHash: input.tokenHash ?? `test-token-${newId()}`,
    invitedBy: input.invitedBy,
    status: input.status ?? 'pending',
    expiresAt: input.expiresAt ?? now + 7 * 24 * 60 * 60 * 1000,
    acceptedBy: null,
    acceptedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  ctx.api.db.getDb().insert(ctx.api.schema.namespaceInvitations).values(row).run();
  return row;
}

export function seedQualityIssue(
  ctx: TestCtx,
  input: {
    namespaceId: string;
    entryId: string;
    key: string;
    locale: string;
    issueType?: QualityIssue['issueType'];
    severity?: QualityIssue['severity'];
  },
): QualityIssue {
  const now = nowMs();
  const row: QualityIssue = {
    id: newId(),
    namespaceId: input.namespaceId,
    entryId: input.entryId,
    key: input.key,
    locale: input.locale,
    sourceLocale: null,
    issueType: input.issueType ?? 'missing_translation',
    severity: input.severity ?? 'warning',
    status: 'open',
    sourceVersion: null,
    targetVersion: null,
    ruleVersion: 'test',
    details: null,
    suppressedBy: null,
    suppressedReason: null,
    suppressedAt: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  ctx.api.db.getDb().insert(ctx.api.schema.qualityIssues).values(row).run();
  return row;
}

export function seedTaskLog(
  ctx: TestCtx,
  input: {
    taskId: string;
    itemId?: string | null;
    event?: TranslationTaskLog['event'];
    workerId?: string | null;
    actorId?: string | null;
    message?: string | null;
  },
): TranslationTaskLog {
  const row: TranslationTaskLog = {
    id: newId(),
    taskId: input.taskId,
    itemId: input.itemId ?? null,
    event: input.event ?? 'create',
    workerId: input.workerId ?? null,
    actorId: input.actorId ?? null,
    message: input.message ?? null,
    metadata: null,
    createdAt: nowMs(),
  };
  ctx.api.db.getDb().insert(ctx.api.schema.translationTaskLogs).values(row).run();
  return row;
}

export { setupTestDbFromTemplate, setupTestDb };
