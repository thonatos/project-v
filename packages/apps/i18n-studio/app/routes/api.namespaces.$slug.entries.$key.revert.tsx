import { requireRole } from '~/lib/auth.server';
import { revert } from '~/lib/services/version.server';
import { getEntryByKey } from '~/lib/services/entry.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.entries.$key.revert';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{ locale?: string; version?: number }>(request);
    if (!body.locale || typeof body.version !== 'number')
      return jsonError(400, 'invalid_input', 'locale 与 version 必填');
    const entry = getEntryByKey(ctx.namespace.id, decodeURIComponent(params.key!));
    if (!entry) return jsonError(404, 'not_found', '词条不存在');
    const r = revert(entry.id, body.locale, body.version, ctx.user.id);
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}
