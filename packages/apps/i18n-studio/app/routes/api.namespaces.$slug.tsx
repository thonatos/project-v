import { requireRole } from '~/lib/auth.server';
import { updateNamespace, deleteNamespace } from '~/lib/services/namespace.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
    return jsonOk({ namespace: ctx.namespace, role: ctx.role });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const slug = params.slug!;
    if (request.method === 'PATCH') {
      await requireRole(request, slug, ['admin']);
      const body = await readJson<{ name?: string; defaultLocale?: string; locales?: string[]; publicRead?: boolean }>(
        request,
      );
      const ns = updateNamespace(slug, body);
      return jsonOk({ namespace: ns });
    }
    if (request.method === 'DELETE') {
      await requireRole(request, slug, ['admin']);
      deleteNamespace(slug);
      return jsonOk({ ok: true });
    }
    return jsonError(405, 'method_not_allowed', 'use PATCH or DELETE');
  } catch (e) {
    return handleError(e);
  }
}
