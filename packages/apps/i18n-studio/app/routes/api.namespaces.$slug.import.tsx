import { requireRole } from '~/lib/auth.server';
import { importFlat } from '~/lib/services/entry.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.import';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{ locale?: string; entries?: Record<string, string>; asDraft?: boolean }>(request);
    if (!body.locale || !body.entries) return jsonError(400, 'invalid_input', 'locale 与 entries 必填');
    const r = importFlat({
      namespaceId: ctx.namespace.id,
      locale: body.locale,
      entries: body.entries,
      asDraft: body.asDraft ?? false,
      actorId: ctx.user.id,
    });
    return jsonOk(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    return handleError(e);
  }
}
