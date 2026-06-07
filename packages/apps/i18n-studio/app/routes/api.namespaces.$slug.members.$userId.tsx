import { requireRole } from '~/lib/auth.server';
import { updateRole, removeMember } from '~/lib/services/membership.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.members.$userId';

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    const userId = params.userId!;
    if (request.method === 'PATCH') {
      const body = await readJson<{ role?: 'admin' | 'editor' | 'viewer' }>(request);
      if (!body.role) return jsonError(400, 'invalid_input', 'role 必填');
      const m = updateRole(ctx.namespace.id, userId, body.role);
      return jsonOk({ membership: m });
    }
    if (request.method === 'DELETE') {
      removeMember(ctx.namespace.id, userId);
      return jsonOk({ ok: true });
    }
    return jsonError(405, 'method_not_allowed', 'use PATCH or DELETE');
  } catch (e) {
    return handleError(e);
  }
}
