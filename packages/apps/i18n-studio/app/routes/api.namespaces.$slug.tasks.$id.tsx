import { requireRole } from '~/lib/auth.server';
import { getTask, cancelTask } from '~/lib/services/task.server';
import { jsonOk, jsonError, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.tasks.$id';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const r = getTask(params.id!);
    if (!r) return jsonError(404, 'not_found', 'task not found');
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'DELETE') return jsonError(405, 'method_not_allowed', 'use DELETE to cancel');
  try {
    await requireRole(request, params.slug!, ['admin']);
    cancelTask(params.id!);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
