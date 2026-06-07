import { requireRole } from '~/lib/auth.server';
import { listVersions } from '~/lib/services/version.server';
import { getEntryByKey } from '~/lib/services/entry.server';
import { jsonOk, jsonError, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.entries.$key.versions';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale');
    if (!locale) return jsonError(400, 'invalid_input', 'locale 参数必填');
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const cursor = url.searchParams.get('cursor');
    const entry = getEntryByKey(ctx.namespace.id, decodeURIComponent(params.key!));
    if (!entry) return jsonError(404, 'not_found', '词条不存在');
    return jsonOk(listVersions(entry.id, locale, { limit, cursor: cursor ? Number(cursor) : null }));
  } catch (e) {
    return handleError(e);
  }
}
