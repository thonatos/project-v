import { requireApiToken } from '~/lib/api-token.server';
import { retryTaskItem } from '~/lib/services/task.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.items.$itemId.retry';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const tok = requireApiToken(request, 'task');
    const body = await readJson<{ maxAttempts?: number }>(request);
    const item = retryTaskItem(params.id!, params.itemId!, `token:${tok.token.id}`, {
      maxAttempts: body.maxAttempts,
    });
    return jsonOk({ item });
  } catch (e) {
    return handleError(e);
  }
}
