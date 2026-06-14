import crypto from 'node:crypto';

import { eq, and, isNull } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { apiTokens, namespaces } from '~/db/schema';
import type { TokenScope, ApiToken } from '~/db/schema';
import { writeAuditEvent } from '~/lib/services/audit.server';

const TOKEN_PREFIX_LEN = 6;

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function generateTokenString(scope: TokenScope): string {
  const prefix = scope === 'task' ? 'tk_' : scope === 'write' ? 'wr_' : 'ro_';
  return prefix + crypto.randomBytes(24).toString('base64url');
}

export interface CreatedToken {
  token: ApiToken;
  plaintext: string;
}

export function createApiToken(input: {
  namespaceId: string;
  name: string;
  scope: TokenScope;
  createdBy: string;
}): CreatedToken {
  const db = getDb();
  const plaintext = generateTokenString(input.scope);
  const tokenHash = hashToken(plaintext);
  const tokenPrefix = plaintext.slice(0, TOKEN_PREFIX_LEN);
  const now = nowMs();
  const id = newId();
  const row: ApiToken = {
    id,
    namespaceId: input.namespaceId,
    name: input.name,
    scope: input.scope,
    tokenHash,
    tokenPrefix,
    createdBy: input.createdBy,
    createdAt: now,
    revokedAt: null,
  };
  db.transaction((tx) => {
    tx.insert(apiTokens).values(row).run();
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: input.namespaceId,
      actorId: input.createdBy,
      action: 'token.create',
      resourceType: 'api_token',
      resourceId: row.id,
      metadata: { name: row.name, scope: row.scope, tokenPrefix: row.tokenPrefix },
    });
  });
  return { token: row, plaintext };
}

export function listApiTokens(namespaceId: string): ApiToken[] {
  const db = getDb();
  return db.select().from(apiTokens).where(eq(apiTokens.namespaceId, namespaceId)).all();
}

export function revokeApiToken(id: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const existing = tx.select().from(apiTokens).where(eq(apiTokens.id, id)).get();
    const revokedAt = nowMs();
    tx.update(apiTokens).set({ revokedAt }).where(eq(apiTokens.id, id)).run();
    if (existing) {
      writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: existing.namespaceId,
        actorId: existing.createdBy,
        action: 'token.revoke',
        resourceType: 'api_token',
        resourceId: existing.id,
        before: { revokedAt: existing.revokedAt },
        after: { revokedAt },
        metadata: { name: existing.name, scope: existing.scope, tokenPrefix: existing.tokenPrefix },
      });
    }
  });
}

export interface VerifiedToken {
  token: ApiToken;
  namespaceSlug: string;
}

export function verifyToken(plaintext: string, requiredScope: TokenScope): VerifiedToken | null {
  if (!plaintext) return null;
  const db = getDb();
  const tokenHash = hashToken(plaintext);
  const row = db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.scope, requiredScope), isNull(apiTokens.revokedAt)))
    .get();
  if (!row) return null;
  const ns = db.select().from(namespaces).where(eq(namespaces.id, row.namespaceId)).get();
  if (!ns) return null;
  return { token: row, namespaceSlug: ns.slug };
}

export function extractBearer(request: Request): string | null {
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

export function requireApiToken(request: Request, scope: TokenScope): VerifiedToken {
  const plaintext = extractBearer(request);
  if (!plaintext) throw new Response('Unauthorized', { status: 401 });
  const v = verifyToken(plaintext, scope);
  if (!v) throw new Response('Unauthorized', { status: 401 });
  return v;
}
