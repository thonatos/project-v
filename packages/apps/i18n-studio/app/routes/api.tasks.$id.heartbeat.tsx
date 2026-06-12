import { requireApiToken } from '~/lib/api-token.server';
import { heartbeatTask } from '~/lib/services/task.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.heartbeat';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    requireApiToken(request, 'task');
    const body = await readJson<{ workerId?: string; leaseMs?: number }>(request);
    const workerId = body.workerId ?? 'unknown';
    const r = heartbeatTask(params.id!, workerId, { leaseMs: body.leaseMs });
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}
