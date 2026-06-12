import { requireRole } from '~/lib/auth.server';
import { exportFlat } from '~/lib/services/export.server';
import { jsonOk, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.export';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const url = new URL(request.url);
    const localeRaw = url.searchParams.get('locale');
    const locale = localeRaw
      ? localeRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const atVersionRaw = url.searchParams.get('at_version');
    const atVersion = atVersionRaw ? Number(atVersionRaw) : undefined;
    const bundleVersionRaw = url.searchParams.get('bundle_version');
    const bundleVersion = bundleVersionRaw ? Number(bundleVersionRaw) : undefined;
    const data = exportFlat({ namespaceId: ctx.namespace.id, locale, atVersion, bundleVersion });
    return jsonOk(data);
  } catch (e) {
    return handleError(e);
  }
}
