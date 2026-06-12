import { requireRole } from '~/lib/auth.server';
import { listMembers } from '~/lib/services/membership.server';
import { createInvitation, listInvitations } from '~/lib/services/invitation.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.members._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    return jsonOk({ members: listMembers(ctx.namespace.id), invitations: listInvitations(ctx.namespace.id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    const body = await readJson<{ email?: string; role?: 'admin' | 'editor' | 'viewer' }>(request);
    if (!body.email || !body.role) return jsonError(400, 'invalid_input', 'email 与 role 必填');
    const result = createInvitation({
      namespaceId: ctx.namespace.id,
      email: body.email,
      role: body.role,
      invitedBy: ctx.user.id,
    });
    return jsonOk(result, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
