import { requireApiToken } from '~/lib/api-token.server';
import { writeResults } from '~/lib/services/task.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.results';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const tok = requireApiToken(request, 'task');
    const body = await readJson<{ results?: Array<{ entryId: string; locale: string; value: string }> }>(request);
    if (!body.results || body.results.length === 0) return jsonError(400, 'invalid_input', 'results 不能为空');
    const r = writeResults(params.id!, body.results, `token:${tok.token.id}`);
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}
