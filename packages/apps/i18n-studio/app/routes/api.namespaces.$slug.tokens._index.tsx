import { requireRole } from '~/lib/auth.server';
import { listApiTokens, createApiToken } from '~/lib/api-token.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.tokens._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    return jsonOk({ tokens: listApiTokens(ctx.namespace.id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    const body = await readJson<{ name?: string; scope?: 'task' | 'readonly' | 'write' }>(request);
    if (!body.name || !body.scope) return jsonError(400, 'invalid_input', 'name 与 scope 必填');
    if (!['task', 'readonly', 'write'].includes(body.scope)) {
      return jsonError(400, 'invalid_input', 'scope 必须为 task/readonly/write');
    }
    const r = createApiToken({
      namespaceId: ctx.namespace.id,
      name: body.name,
      scope: body.scope,
      createdBy: ctx.user.id,
    });
    return jsonOk(r, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
