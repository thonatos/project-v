import { requireRole } from '~/lib/auth.server';
import { extractBearer, verifyToken } from '~/lib/api-token.server';
import { importFlat } from '~/lib/services/entry.server';
import { jsonOk, jsonError, readJson, handleError } from '~/lib/api.server';
import { getNamespaceBySlug } from '~/lib/services/namespace.server';

import type { Route } from './+types/api.namespaces.$slug.import';

interface ImportResolved {
  namespaceId: string;
  actorId: string;
}

/**
 * 解析 import 鉴权:先尝试 write token(绑定 namespace),否则回退 session role。
 * 二者满足其一即放行;均不满足时由各自的鉴权逻辑抛出 Response。
 */
async function resolveImportAuth(request: Request, slug: string): Promise<ImportResolved> {
  const plaintext = extractBearer(request);
  if (plaintext) {
    const v = verifyToken(plaintext, 'write');
    // 有 Bearer 且为有效、绑定到本 namespace 的 write token → 放行
    if (v && v.namespaceSlug === slug) {
      const ns = getNamespaceBySlug(slug);
      if (!ns) throw new Response('Not Found', { status: 404 });
      return { namespaceId: ns.id, actorId: `token:${v.token.id}` };
    }
    // 有 Bearer 但 token 无效/跨 namespace:不回退到 session,直接拒绝
    throw new Response('Unauthorized', { status: 401 });
  }
  // 无 Bearer:回退 session role 鉴权
  const ctx = await requireRole(request, slug, ['admin', 'editor']);
  return { namespaceId: ctx.namespace.id, actorId: ctx.user.id };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'use POST');
  try {
    const auth = await resolveImportAuth(request, params.slug!);
    const body = await readJson<{ locale?: string; entries?: Record<string, string>; asDraft?: boolean }>(request);
    if (!body.locale || !body.entries) return jsonError(400, 'invalid_input', 'locale 与 entries 必填');
    const r = importFlat({
      namespaceId: auth.namespaceId,
      locale: body.locale,
      entries: body.entries,
      asDraft: body.asDraft ?? false,
      actorId: auth.actorId,
    });
    return jsonOk(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    return handleError(e);
  }
}
