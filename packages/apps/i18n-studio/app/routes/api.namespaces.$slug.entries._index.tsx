import { requireRole } from '~/lib/auth.server';
import { listEntries, type GroupMode, type IncludeMode, type StatusFilter } from '~/lib/services/query.server';
import { jsonOk, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.entries._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') ?? undefined;
    const view = url.searchParams.get('view') === 'all' ? 'all' : undefined;
    const localeRaw = url.searchParams.get('locale');
    const locale = localeRaw
      ? localeRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const atVersionRaw = url.searchParams.get('at_version');
    const atVersion = atVersionRaw ? Number(atVersionRaw) : undefined;
    const group = (url.searchParams.get('group') as GroupMode | null) ?? 'key';
    const include = (url.searchParams.get('include') as IncludeMode | null) ?? 'published';
    const status = (url.searchParams.get('status') as StatusFilter | null) ?? 'all';
    const cursor = url.searchParams.get('cursor');
    const pageSize = Number(url.searchParams.get('page_size') ?? 100);

    const result = listEntries(ctx.namespace.id, {
      prefix,
      view,
      locale,
      atVersion,
      group,
      include,
      status,
      cursor,
      pageSize,
    });
    return jsonOk(result);
  } catch (e) {
    return handleError(e);
  }
}
