import { getLocaleManifest, requireSnapshotAccess } from '~/lib/services/snapshot.server';
import { handleError } from '~/lib/api.server';

import type { Route } from './+types/snapshot.$slug.meta';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const access = requireSnapshotAccess(request, params.slug!);
    const manifest = getLocaleManifest(params.slug!);
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `${access.isPublic ? 'public' : 'private'}, max-age=60`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
