import { getBundle, requireSnapshotAccess } from '~/lib/services/snapshot.server';
import { handleError } from '~/lib/api.server';

import type { Route } from './+types/snapshot.$slug._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const access = requireSnapshotAccess(request, params.slug!);
    const url = new URL(request.url);
    const localeRaw = url.searchParams.get('locale');
    const locales = localeRaw
      ? localeRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const bvRaw = url.searchParams.get('bundle_version');
    const bundleVersion = bvRaw ? Number(bvRaw) : undefined;
    const { bundle, meta } = getBundle({ slug: params.slug!, locales, bundleVersion });

    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === meta.etag) {
      return new Response(null, { status: 304, headers: { ETag: meta.etag } });
    }
    const cache =
      typeof bundleVersion === 'number'
        ? `${access.isPublic ? 'public' : 'private'}, immutable, max-age=31536000`
        : `${access.isPublic ? 'public' : 'private'}, max-age=60`;
    return new Response(JSON.stringify(bundle), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: meta.etag,
        'Cache-Control': cache,
        'X-Bundle-Version': String(meta.bundleVersion),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
