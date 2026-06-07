import { useLoaderData, useOutletContext } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceStats, getNamespaceLocales } from '~/lib/services/namespace.server';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/ns.$slug._index';
import type { NsContext } from './ns.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  return {
    stats: getNamespaceStats(ctx.namespace.id),
    locales: getNamespaceLocales(ctx.namespace),
    namespace: ctx.namespace,
  };
}

export default function NsOverview() {
  useOutletContext<NsContext>();
  const { stats, locales, namespace } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{namespace.name}</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{stats.entriesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{stats.draftCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl">{stats.membersCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Locales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{locales.join(', ')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
