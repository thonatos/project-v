import { requireRole } from '~/lib/auth.server';
import { revokeApiToken } from '~/lib/api-token.server';
import { jsonOk, jsonError, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.tokens.$id';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'DELETE') return jsonError(405, 'method_not_allowed', 'use DELETE');
  try {
    await requireRole(request, params.slug!, ['admin']);
    revokeApiToken(params.id!);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
