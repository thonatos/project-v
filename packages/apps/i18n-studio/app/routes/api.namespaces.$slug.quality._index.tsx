import { requireRole } from '~/lib/auth.server';
import { listQualityIssues, scanQualityIssues } from '~/lib/services/quality.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.quality._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    const url = new URL(request.url);
    const issues = listQualityIssues({
      namespaceId: ctx.namespace.id,
      issueType: (url.searchParams.get('issue_type') as never) || undefined,
      locale: url.searchParams.get('locale') ?? undefined,
      prefix: url.searchParams.get('prefix') ?? undefined,
      severity: (url.searchParams.get('severity') as never) || undefined,
      status: (url.searchParams.get('status') as never) || 'open',
      limit: Number(url.searchParams.get('limit') ?? 100),
    });
    return jsonOk({ issues });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{ intent?: string }>(request);
    if (body.intent !== 'scan') return jsonError(400, 'invalid_input', 'intent must be scan');
    const result = scanQualityIssues(ctx.namespace.id, ctx.user.id);
    return jsonOk({ result });
  } catch (e) {
    return handleError(e);
  }
}
