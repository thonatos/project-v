import { useFetcher, useLoaderData, Form } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceLocales, updateNamespace, deleteNamespace } from '~/lib/services/namespace.server';
import { listApiTokens, createApiToken, revokeApiToken } from '~/lib/api-token.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { redirect } from 'react-router';

import type { Route } from './+types/ns.$slug.settings';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
  return {
    namespace: ctx.namespace,
    locales: getNamespaceLocales(ctx.namespace),
    tokens: listApiTokens(ctx.namespace.id),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'update') {
    const name = String(form.get('name') ?? '');
    const localesRaw = String(form.get('locales') ?? '');
    const defaultLocale = String(form.get('defaultLocale') ?? '');
    const publicRead = form.get('publicRead') === 'true';
    try {
      updateNamespace(ctx.namespace.slug, {
        name,
        defaultLocale,
        locales: localesRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        publicRead,
      });
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'update failed' };
    }
  }
  if (intent === 'create-token') {
    const name = String(form.get('tokenName') ?? '');
    const scope = String(form.get('scope') ?? 'task') as 'task' | 'readonly';
    if (!name) return { error: 'token name 必填' };
    const r = createApiToken({ namespaceId: ctx.namespace.id, name, scope, createdBy: ctx.user.id });
    return { plaintext: r.plaintext, tokenId: r.token.id };
  }
  if (intent === 'revoke-token') {
    const id = String(form.get('tokenId') ?? '');
    revokeApiToken(id);
    return { ok: true };
  }
  if (intent === 'delete') {
    deleteNamespace(ctx.namespace.slug);
    throw redirect('/');
  }
  return { error: 'unknown intent' };
}

export default function SettingsPage() {
  const { namespace, locales, tokens } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">设置</h1>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 font-semibold">基本</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="update" />
          <div>
            <Label>名称</Label>
            <Input name="name" defaultValue={namespace.name} required />
          </div>
          <div>
            <Label>Slug(不可变)</Label>
            <Input value={namespace.slug} disabled />
          </div>
          <div>
            <Label>Default locale</Label>
            <Input name="defaultLocale" defaultValue={namespace.defaultLocale} required />
          </div>
          <div>
            <Label>Locales(逗号分隔)</Label>
            <Input name="locales" defaultValue={locales.join(',')} />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <input type="checkbox" name="publicRead" value="true" defaultChecked={namespace.publicRead} />
              public_read(允许匿名读 /snapshot/{namespace.slug})
            </Label>
          </div>
          <Button type="submit">保存</Button>
        </Form>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 font-semibold">API Tokens</h2>
        <Form method="post" className="mb-4 flex items-end gap-2">
          <input type="hidden" name="intent" value="create-token" />
          <div>
            <Label className="text-xs">名称</Label>
            <Input name="tokenName" required />
          </div>
          <div>
            <Label className="text-xs">Scope</Label>
            <select name="scope" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="task">task</option>
              <option value="readonly">readonly</option>
            </select>
          </div>
          <Button type="submit">生成</Button>
        </Form>
        {fetcher.data && 'plaintext' in (fetcher.data as Record<string, unknown>) ? (
          <p className="rounded bg-yellow-100 p-2 text-xs">
            新 token(仅展示一次,请保存):{' '}
            <code className="font-mono">{(fetcher.data as { plaintext: string }).plaintext}</code>
          </p>
        ) : null}
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">scope</th>
              <th className="px-3 py-2 text-left">name</th>
              <th className="px-3 py-2 text-left">prefix</th>
              <th className="px-3 py-2 text-left">created</th>
              <th className="px-3 py-2 text-left">status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">{t.scope}</td>
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.tokenPrefix}…</td>
                <td className="px-3 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">{t.revokedAt ? 'revoked' : 'active'}</td>
                <td className="px-3 py-2 text-right">
                  {!t.revokedAt ? (
                    <fetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="revoke-token" />
                      <input type="hidden" name="tokenId" value={t.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        撤销
                      </Button>
                    </fetcher.Form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border border-destructive p-4">
        <h2 className="mb-3 font-semibold text-destructive">Danger zone</h2>
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`删除命名空间 ${namespace.slug}?将级联删除所有词条/翻译/成员/token。`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <Button type="submit" variant="destructive">
            删除命名空间
          </Button>
        </Form>
      </section>
    </div>
  );
}
