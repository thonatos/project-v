import { requireRole } from '~/lib/auth.server';
import { resendInvitation, revokeInvitation } from '~/lib/services/invitation.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.invitations.$id';

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    if (request.method === 'PATCH') {
      const body = await readJson<{ intent?: 'resend' }>(request);
      if (body.intent !== 'resend') return jsonError(400, 'invalid_input', 'intent must be resend');
      const result = resendInvitation(params.id!, ctx.user.id, ctx.namespace.id);
      return jsonOk(result);
    }
    if (request.method === 'DELETE') {
      const invitation = revokeInvitation(params.id!, ctx.user.id, ctx.namespace.id);
      return jsonOk({ invitation });
    }
    return jsonError(405, 'method_not_allowed', 'use PATCH or DELETE');
  } catch (e) {
    return handleError(e);
  }
}
