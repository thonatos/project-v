import { requireUser } from '~/lib/auth.server';
import { listNamespaces, createNamespace } from '~/lib/services/namespace.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.namespaces._index';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const user = await requireUser(request);
    return jsonOk({ namespaces: listNamespaces(user.id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const user = await requireUser(request);
    const body = await readJson<{ slug?: string; name?: string; locales?: string[]; defaultLocale?: string }>(request);
    if (!body.slug || !body.name) return jsonError(400, 'invalid_input', 'slug 与 name 必填');
    const ns = createNamespace({
      slug: body.slug,
      name: body.name,
      locales: body.locales,
      defaultLocale: body.defaultLocale,
      createdBy: user.id,
    });
    return jsonOk({ namespace: ns }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
