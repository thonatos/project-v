import { requireRole } from '~/lib/auth.server';
import { publishBatch } from '~/lib/services/publish.server';
import { getEntryByKey } from '~/lib/services/entry.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug.publish-batch';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
    const body = await readJson<{
      items?: Array<{ entry_id?: string; key?: string; locale: string; version: number }>;
    }>(request);
    if (!body.items || body.items.length === 0) return jsonError(400, 'invalid_input', 'items 不能为空');
    const resolved = body.items.map((it) => {
      let entryId = it.entry_id;
      if (!entryId && it.key) {
        const entry = getEntryByKey(ctx.namespace.id, it.key);
        if (!entry) throw new Response(`entry not found: ${it.key}`, { status: 404 });
        entryId = entry.id;
      }
      if (!entryId) throw new Response('entry_id 或 key 必填', { status: 400 });
      return { entryId, locale: it.locale, version: it.version };
    });
    const r = publishBatch(resolved, ctx.user.id);
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}
