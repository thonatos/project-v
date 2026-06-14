import { requireRole } from '~/lib/auth.server';
import { updateQualityIssueStatus } from '~/lib/services/quality.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.quality.$id';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'PATCH') return jsonError(405, 'method_not_allowed', 'use PATCH');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{ status?: 'resolved' | 'suppressed'; reason?: string }>(request);
    if (body.status !== 'resolved' && body.status !== 'suppressed') {
      return jsonError(400, 'invalid_input', 'status must be resolved or suppressed');
    }
    const issue = updateQualityIssueStatus(params.id!, {
      status: body.status,
      reason: body.reason,
      actorId: ctx.user.id,
      namespaceId: ctx.namespace.id,
    });
    return jsonOk({ issue });
  } catch (e) {
    return handleError(e);
  }
}
