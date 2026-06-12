import { Form, useLoaderData, useOutletContext } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { listAuditEvents } from '~/lib/services/audit.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import type { Route } from './+types/dashboard.$slug.audit';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
  const url = new URL(request.url);
  const events = listAuditEvents({
    namespaceId: ctx.namespace.id,
    action: url.searchParams.get('action') ?? undefined,
    resourceType: url.searchParams.get('resource_type') ?? undefined,
    actorId: url.searchParams.get('actor_id') ?? undefined,
    limit: Number(url.searchParams.get('limit') ?? 100),
  });
  return {
    namespace: ctx.namespace,
    events,
    filters: {
      action: url.searchParams.get('action') ?? '',
      resourceType: url.searchParams.get('resource_type') ?? '',
      actorId: url.searchParams.get('actor_id') ?? '',
    },
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Audit · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export default function AuditPage() {
  useOutletContext<NsContext>();
  const { namespace, events, filters } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Review write events for <span className="font-mono">{namespace.slug}</span>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="action">Action</Label>
              <Input id="action" name="action" defaultValue={filters.action} placeholder="release.publish" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resource_type">Resource type</Label>
              <Input id="resource_type" name="resource_type" defaultValue={filters.resourceType} placeholder="entry" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actor_id">Actor id</Label>
              <Input id="actor_id" name="actor_id" defaultValue={filters.actorId} className="font-mono" />
            </div>
            <Button type="submit">Apply</Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>time</TableHead>
                <TableHead>action</TableHead>
                <TableHead>actor</TableHead>
                <TableHead>resource</TableHead>
                <TableHead>metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit events
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.actorType}:{event.actorId ?? 'unknown'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.resourceType}:{event.resourceId ?? 'unknown'}
                    </TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                      {event.metadata ?? event.after ?? event.before ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
