import { requireRole } from '~/lib/auth.server';
import { handleError, jsonOk } from '~/lib/api.server';
import { listAuditEvents, type AuditActorType } from '~/lib/services/audit.server';

import type { Route } from './+types/api.namespaces.$slug.audit._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin']);
    const url = new URL(request.url);
    const actorId = url.searchParams.get('actor_id') ?? undefined;
    const actorType = (url.searchParams.get('actor_type') as AuditActorType | null) ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const resourceType = url.searchParams.get('resource_type') ?? undefined;
    const resourceId = url.searchParams.get('resource_id') ?? undefined;
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const limitRaw = url.searchParams.get('limit');
    const events = listAuditEvents({
      namespaceId: ctx.namespace.id,
      actorId,
      actorType,
      action,
      resourceType,
      resourceId,
      from: fromRaw ? Number(fromRaw) : undefined,
      to: toRaw ? Number(toRaw) : undefined,
      limit: limitRaw ? Number(limitRaw) : undefined,
    });
    return jsonOk({ events });
  } catch (e) {
    return handleError(e);
  }
}
