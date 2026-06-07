import { requireRole } from '~/lib/auth.server';
import { listTasks, createTask } from '~/lib/services/task.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.tasks._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? undefined;
    return jsonOk({ tasks: listTasks(ctx.namespace.id, status) });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{
      filter?: { prefix?: string; missingLocale?: string };
      entryIds?: string[];
      targetLocales?: string[];
      sourceLocale?: string;
    }>(request);
    if (!body.targetLocales || body.targetLocales.length === 0) {
      return jsonError(400, 'invalid_input', 'target_locales 不能为空');
    }
    const task = createTask({
      namespaceId: ctx.namespace.id,
      filter: body.filter,
      entryIds: body.entryIds,
      targetLocales: body.targetLocales,
      sourceLocale: body.sourceLocale,
      createdBy: ctx.user.id,
    });
    return jsonOk({ task }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
