import { requireApiToken } from '~/lib/api-token.server';
import { failTask } from '~/lib/services/task.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.fail';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    requireApiToken(request, 'task');
    const body = await readJson<{ reason?: string }>(request);
    const r = failTask(params.id!, body.reason ?? 'unspecified');
    return jsonOk({ task: r });
  } catch (e) {
    return handleError(e);
  }
}
