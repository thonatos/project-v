import crypto from 'node:crypto';

import { eq, and, isNull } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { apiTokens, namespaces } from '~/db/schema';
import type { TokenScope, ApiToken } from '~/db/schema';

const TOKEN_PREFIX_LEN = 6;

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function generateTokenString(scope: TokenScope): string {
  const prefix = scope === 'task' ? 'tk_' : 'ro_';
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
  db.insert(apiTokens).values(row).run();
  return { token: row, plaintext };
}

export function listApiTokens(namespaceId: string): ApiToken[] {
  const db = getDb();
  return db.select().from(apiTokens).where(eq(apiTokens.namespaceId, namespaceId)).all();
}

export function revokeApiToken(id: string): void {
  const db = getDb();
  db.update(apiTokens).set({ revokedAt: nowMs() }).where(eq(apiTokens.id, id)).run();
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
