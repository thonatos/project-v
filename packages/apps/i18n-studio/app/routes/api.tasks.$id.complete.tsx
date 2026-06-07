import { requireApiToken } from '~/lib/api-token.server';
import { completeTask } from '~/lib/services/task.server';
import { jsonOk, jsonError, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.complete';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    requireApiToken(request, 'task');
    const r = completeTask(params.id!);
    return jsonOk({ task: r });
  } catch (e) {
    return handleError(e);
  }
}
