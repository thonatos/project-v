import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { auditEvents } from '~/db/schema';
import type { AuditEvent } from '~/db/schema';

export type AuditActorType = AuditEvent['actorType'];

export interface WriteAuditInput {
  namespaceId?: string | null;
  actorId?: string | null;
  actorType?: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt?: number;
}

export interface ListAuditInput {
  namespaceId?: string;
  actorId?: string;
  actorType?: AuditActorType;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: number;
  to?: number;
  limit?: number;
}

function encodeJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export function writeAuditEvent(tx: ReturnType<typeof getDb>, input: WriteAuditInput): AuditEvent {
  const row: AuditEvent = {
    id: newId(),
    namespaceId: input.namespaceId ?? null,
    actorId: input.actorId ?? null,
    actorType: input.actorType ?? 'user',
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    requestId: input.requestId ?? null,
    before: encodeJson(input.before),
    after: encodeJson(input.after),
    metadata: encodeJson(input.metadata),
    createdAt: input.createdAt ?? nowMs(),
  };
  tx.insert(auditEvents).values(row).run();
  return row;
}

export function writeAudit(input: WriteAuditInput): AuditEvent {
  const db = getDb();
  return db.transaction((tx) => writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, input));
}

export function listAuditEvents(input: ListAuditInput = {}): AuditEvent[] {
  const db = getDb();
  const limit = Math.min(input.limit ?? 100, 500);
  return db
    .select()
    .from(auditEvents)
    .where(
      and(
        input.namespaceId ? eq(auditEvents.namespaceId, input.namespaceId) : undefined,
        input.actorId ? eq(auditEvents.actorId, input.actorId) : undefined,
        input.actorType ? eq(auditEvents.actorType, input.actorType) : undefined,
        input.action ? eq(auditEvents.action, input.action) : undefined,
        input.resourceType ? eq(auditEvents.resourceType, input.resourceType) : undefined,
        input.resourceId ? eq(auditEvents.resourceId, input.resourceId) : undefined,
        input.from !== undefined ? gte(auditEvents.createdAt, input.from) : undefined,
        input.to !== undefined ? lte(auditEvents.createdAt, input.to) : undefined,
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .all();
}
