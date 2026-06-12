import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { memberships, namespaceInvitations, users } from '~/db/schema';
import type { NamespaceInvitation, Role } from '~/db/schema';
import { writeAuditEvent } from '~/lib/services/audit.server';

const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function createToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface InvitationWithToken {
  invitation: NamespaceInvitation;
  token: string;
}

export function listInvitations(namespaceId: string): NamespaceInvitation[] {
  const db = getDb();
  return db
    .select()
    .from(namespaceInvitations)
    .where(eq(namespaceInvitations.namespaceId, namespaceId))
    .orderBy(desc(namespaceInvitations.createdAt))
    .all();
}

export function createInvitation(input: {
  namespaceId: string;
  email: string;
  role: Role;
  invitedBy: string;
  ttlMs?: number;
}): InvitationWithToken {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const token = createToken();
  const tokenHash = hashToken(token);
  const now = nowMs();
  const expiresAt = now + (input.ttlMs ?? DEFAULT_INVITATION_TTL_MS);
  return db.transaction((tx) => {
    const targetUser = tx.select().from(users).where(eq(users.email, email)).get();
    if (targetUser) {
      const existingMembership = tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.namespaceId, input.namespaceId), eq(memberships.userId, targetUser.id)))
        .get();
      if (existingMembership) throw new Error('用户已是成员,请使用 PATCH 更新角色');
    }
    const existingPending = tx
      .select()
      .from(namespaceInvitations)
      .where(
        and(
          eq(namespaceInvitations.namespaceId, input.namespaceId),
          eq(namespaceInvitations.email, email),
          eq(namespaceInvitations.status, 'pending'),
        ),
      )
      .get();
    if (existingPending) {
      tx.update(namespaceInvitations)
        .set({ role: input.role, tokenHash, expiresAt, invitedBy: input.invitedBy, updatedAt: now })
        .where(eq(namespaceInvitations.id, existingPending.id))
        .run();
      const invitation = tx
        .select()
        .from(namespaceInvitations)
        .where(eq(namespaceInvitations.id, existingPending.id))
        .get()!;
      writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: input.namespaceId,
        actorId: input.invitedBy,
        action: 'invitation.resend',
        resourceType: 'namespace_invitation',
        resourceId: invitation.id,
        metadata: { email, role: input.role, expiresAt },
      });
      return { invitation, token };
    }

    const invitation: NamespaceInvitation = {
      id: newId(),
      namespaceId: input.namespaceId,
      email,
      role: input.role,
      tokenHash,
      invitedBy: input.invitedBy,
      status: 'pending',
      expiresAt,
      acceptedBy: null,
      acceptedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(namespaceInvitations).values(invitation).run();
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: input.namespaceId,
      actorId: input.invitedBy,
      action: 'invitation.create',
      resourceType: 'namespace_invitation',
      resourceId: invitation.id,
      after: invitation,
      metadata: { email, role: input.role, expiresAt },
    });
    return { invitation, token };
  });
}

export function resendInvitation(invitationId: string, actorId: string, namespaceId?: string): InvitationWithToken {
  const db = getDb();
  const token = createToken();
  const tokenHash = hashToken(token);
  const now = nowMs();
  const expiresAt = now + DEFAULT_INVITATION_TTL_MS;
  return db.transaction((tx) => {
    const invitation = tx.select().from(namespaceInvitations).where(eq(namespaceInvitations.id, invitationId)).get();
    if (!invitation) throw new Response('invitation not found', { status: 404 });
    if (namespaceId && invitation.namespaceId !== namespaceId)
      throw new Response('invitation not found', { status: 404 });
    if (invitation.status !== 'pending') throw new Response(`invitation is not pending`, { status: 409 });
    tx.update(namespaceInvitations)
      .set({ tokenHash, expiresAt, invitedBy: actorId, updatedAt: now })
      .where(eq(namespaceInvitations.id, invitationId))
      .run();
    const updated = tx.select().from(namespaceInvitations).where(eq(namespaceInvitations.id, invitationId)).get()!;
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: invitation.namespaceId,
      actorId,
      action: 'invitation.resend',
      resourceType: 'namespace_invitation',
      resourceId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role, expiresAt },
    });
    return { invitation: updated, token };
  });
}

export function revokeInvitation(invitationId: string, actorId: string, namespaceId?: string): NamespaceInvitation {
  const db = getDb();
  return db.transaction((tx) => {
    const invitation = tx.select().from(namespaceInvitations).where(eq(namespaceInvitations.id, invitationId)).get();
    if (!invitation) throw new Response('invitation not found', { status: 404 });
    if (namespaceId && invitation.namespaceId !== namespaceId)
      throw new Response('invitation not found', { status: 404 });
    if (invitation.status !== 'pending') return invitation;
    const now = nowMs();
    tx.update(namespaceInvitations)
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(eq(namespaceInvitations.id, invitationId))
      .run();
    const updated = tx.select().from(namespaceInvitations).where(eq(namespaceInvitations.id, invitationId)).get()!;
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: invitation.namespaceId,
      actorId,
      action: 'invitation.revoke',
      resourceType: 'namespace_invitation',
      resourceId: invitation.id,
      before: invitation,
      after: updated,
    });
    return updated;
  });
}

export function acceptInvitation(
  token: string,
  userId: string,
): { invitation: NamespaceInvitation; membershipId: string } {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = nowMs();
  return db.transaction((tx) => {
    const invitation = tx
      .select()
      .from(namespaceInvitations)
      .where(eq(namespaceInvitations.tokenHash, tokenHash))
      .get();
    if (!invitation) throw new Response('invitation not found', { status: 404 });
    if (invitation.status !== 'pending') throw new Response(`invitation is not pending`, { status: 409 });
    if (invitation.expiresAt <= now) throw new Response('invitation expired', { status: 410 });
    const user = tx.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw new Response('user not found', { status: 404 });
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new Response('invitation email mismatch', { status: 403 });
    }
    const existing = tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.namespaceId, invitation.namespaceId), eq(memberships.userId, userId)))
      .get();
    const membershipId = existing?.id ?? newId();
    if (!existing) {
      tx.insert(memberships)
        .values({
          id: membershipId,
          namespaceId: invitation.namespaceId,
          userId,
          role: invitation.role,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    tx.update(namespaceInvitations)
      .set({ status: 'accepted', acceptedBy: userId, acceptedAt: now, updatedAt: now })
      .where(eq(namespaceInvitations.id, invitation.id))
      .run();
    const accepted = tx.select().from(namespaceInvitations).where(eq(namespaceInvitations.id, invitation.id)).get()!;
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: invitation.namespaceId,
      actorId: userId,
      action: 'invitation.accept',
      resourceType: 'namespace_invitation',
      resourceId: invitation.id,
      before: invitation,
      after: accepted,
      metadata: { membershipId, email: invitation.email, role: invitation.role },
    });
    return { invitation: accepted, membershipId };
  });
}
