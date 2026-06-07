import { requireRole } from '~/lib/auth.server';
import { upsertEntry, deleteEntry } from '~/lib/services/entry.server';
import { getEntryDetail } from '~/lib/services/query.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.entries.$key';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const detail = getEntryDetail(ctx.namespace.id, decodeURIComponent(params.key!));
    if (!detail) return jsonError(404, 'not_found', '词条不存在');
    return jsonOk(detail);
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const key = decodeURIComponent(params.key!);
    if (request.method === 'PUT') {
      const body = await readJson<{
        translations?: Record<string, string>;
        description?: string | null;
        asDraft?: boolean;
      }>(request);
      const r = upsertEntry({
        namespaceId: ctx.namespace.id,
        key,
        description: body.description ?? null,
        translations: body.translations ?? {},
        asDraft: body.asDraft ?? false,
        actorId: ctx.user.id,
      });
      return jsonOk(r);
    }
    if (request.method === 'DELETE') {
      const ok = deleteEntry(ctx.namespace.id, key);
      return jsonOk({ ok });
    }
    return jsonError(405, 'method_not_allowed', 'use PUT or DELETE');
  } catch (e) {
    return handleError(e);
  }
}
