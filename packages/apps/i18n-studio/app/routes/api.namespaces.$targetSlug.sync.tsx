import { requireRole } from '~/lib/auth.server';
import { syncSpaces, type SyncStrategy } from '~/lib/services/sync.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$targetSlug.sync';

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const ctx = await requireRole(request, params.targetSlug!, ['admin', 'editor']);
    const body = await readJson<{
      sourceSlug?: string;
      prefix?: string;
      entryIds?: string[];
      locales?: string[];
      strategy?: SyncStrategy;
      atVersion?: number;
      autoPublish?: boolean;
      dryRun?: boolean;
    }>(request);
    if (!body.sourceSlug || !body.locales || !body.strategy) {
      return jsonError(400, 'invalid_input', 'sourceSlug / locales / strategy 必填');
    }
    const r = syncSpaces({
      sourceSlug: body.sourceSlug,
      targetSlug: params.targetSlug!,
      prefix: body.prefix,
      entryIds: body.entryIds,
      locales: body.locales,
      strategy: body.strategy,
      atVersion: body.atVersion,
      autoPublish: body.autoPublish ?? false,
      dryRun: body.dryRun ?? false,
      actorId: ctx.user.id,
    });
    return jsonOk(r);
  } catch (e) {
    return handleError(e);
  }
}
