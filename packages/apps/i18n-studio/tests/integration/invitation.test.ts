import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('namespace invitations', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('creates pending invitation for unregistered email and accepts with matching registered user', async () => {
    const w = await seedWorld(ctx);
    const { auth, invitation, membership, audit } = ctx.api;

    const created = invitation.createInvitation({
      namespaceId: w.docs.id,
      email: 'new-user@example.com',
      role: 'editor',
      invitedBy: w.alice.id,
    });
    expect(created.token).toBeTruthy();
    expect(created.invitation.status).toBe('pending');
    expect(membership.listMembers(w.docs.id).some((member) => member.email === 'new-user@example.com')).toBe(false);

    const user = await auth.registerUser('new-user@example.com', 'pwd', 'New User');
    const accepted = invitation.acceptInvitation(created.token, user.id);

    expect(accepted.invitation.status).toBe('accepted');
    const members = membership.listMembers(w.docs.id);
    expect(members.some((member) => member.email === 'new-user@example.com' && member.role === 'editor')).toBe(true);
    expect(audit.listAuditEvents({ namespaceId: w.docs.id, action: 'invitation.create' })).toHaveLength(1);
    expect(audit.listAuditEvents({ namespaceId: w.docs.id, action: 'invitation.accept' })).toHaveLength(1);
  });

  it('resends duplicate pending invitation, rejects expired and revoked invitations', async () => {
    const w = await seedWorld(ctx);
    const { auth, invitation } = ctx.api;

    const first = invitation.createInvitation({
      namespaceId: w.docs.id,
      email: 'pending@example.com',
      role: 'viewer',
      invitedBy: w.alice.id,
    });
    const resent = invitation.createInvitation({
      namespaceId: w.docs.id,
      email: 'pending@example.com',
      role: 'editor',
      invitedBy: w.alice.id,
    });
    expect(resent.invitation.id).toBe(first.invitation.id);
    expect(resent.token).not.toBe(first.token);
    expect(invitation.listInvitations(w.docs.id).filter((row) => row.email === 'pending@example.com')).toHaveLength(1);

    const revoked = invitation.revokeInvitation(resent.invitation.id, w.alice.id, w.docs.id);
    expect(revoked.status).toBe('revoked');
    const pendingUser = await auth.registerUser('pending@example.com', 'pwd', 'Pending');
    expect(() => invitation.acceptInvitation(resent.token, pendingUser.id)).toThrow();

    const expired = invitation.createInvitation({
      namespaceId: w.docs.id,
      email: 'expired@example.com',
      role: 'viewer',
      invitedBy: w.alice.id,
      ttlMs: -1,
    });
    const expiredUser = await auth.registerUser('expired@example.com', 'pwd', 'Expired');
    expect(() => invitation.acceptInvitation(expired.token, expiredUser.id)).toThrow();
  });

  it('audits member role updates and removals', async () => {
    const w = await seedWorld(ctx);
    const { membership, audit } = ctx.api;

    membership.updateRole(w.docs.id, w.bob.id, 'viewer');
    membership.removeMember(w.docs.id, w.carol.id);

    expect(audit.listAuditEvents({ namespaceId: w.docs.id, action: 'member.role_update' })).toHaveLength(1);
    expect(audit.listAuditEvents({ namespaceId: w.docs.id, action: 'member.remove' })).toHaveLength(1);
  });
});
