import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useRevalidator } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, History } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { upsertEntry } from '~/lib/services/entry.server';
import { getEntryDetail } from '~/lib/services/query.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

import type { Route } from './+types/dashboard.$slug.entries.$key._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const key = decodeURIComponent(params.key!);
  const detail = key === 'new' ? null : getEntryDetail(ctx.namespace.id, key);
  return {
    namespace: { slug: ctx.namespace.slug, name: ctx.namespace.name },
    role: ctx.role,
    locales: getNamespaceLocales(ctx.namespace),
    detail,
    keyParam: key,
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: 'Entry · i18n-studio' }];
  const title =
    data.keyParam === 'new'
      ? `New entry · ${data.namespace.name} · i18n-studio`
      : `${data.keyParam} · ${data.namespace.name} · i18n-studio`;
  return [{ title }];
}

export async function action({ request, params }: Route.ActionArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
  const form = await request.formData();
  const key = String(form.get('key') ?? decodeURIComponent(params.key!));
  const description = String(form.get('description') ?? '');
  const asDraft = form.get('asDraft') === 'true';
  const translations: Record<string, string> = {};
  for (const locale of getNamespaceLocales(ctx.namespace)) {
    const v = form.get(`t_${locale}`);
    if (typeof v === 'string' && v.length > 0) {
      translations[locale] = v;
    }
  }
  try {
    upsertEntry({
      namespaceId: ctx.namespace.id,
      key,
      description: description || null,
      translations,
      asDraft,
      actorId: ctx.user.id,
    });
    throw redirect(`/dashboard/${ctx.namespace.slug}/entries`);
  } catch (e) {
    if (e instanceof Response) throw e;
    return { error: e instanceof Error ? e.message : 'save failed' };
  }
}

export default function EntryEditPage() {
  const { namespace, role, locales, detail, keyParam } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  const isNew = keyParam === 'new';
  const editable = role === 'admin' || role === 'editor';

  const valueFor = (locale: string): { value: string; version: number | null; draftVersion?: number } => {
    if (!detail) return { value: '', version: null };
    const cur = detail.translations.find((t) => t.locale === locale);
    const draft = detail.drafts.find((d) => d.locale === locale);
    return {
      value: draft?.value ?? cur?.value ?? '',
      version: cur?.publishedVersion ?? null,
      draftVersion: draft?.version,
    };
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/dashboard/${namespace.slug}/entries`}>
          <ArrowLeft className="size-4" /> 返回 Entries
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="break-all text-xl">
                {isNew ? '新建词条' : <span className="font-mono">{keyParam}</span>}
              </CardTitle>
              {!isNew && detail?.entry.description ? (
                <CardDescription className="mt-1">{detail.entry.description}</CardDescription>
              ) : null}
            </div>
            {!isNew ? (
              <Button asChild variant="link" className="px-0">
                <Link to={`/dashboard/${namespace.slug}/entries/${encodeURIComponent(keyParam)}/history`}>
                  <History className="size-4" /> 查看全部历史
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-3">
            {isNew ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newKey">key</Label>
                <Input id="newKey" name="key" placeholder="home.title" required className="font-mono" />
              </div>
            ) : (
              <input type="hidden" name="key" value={keyParam} />
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">描述(可选)</Label>
              <Input id="description" name="description" defaultValue={detail?.entry.description ?? ''} />
            </div>
            {locales.map((locale) => {
              const v = valueFor(locale);
              return (
                <div key={locale} className="rounded-md border bg-background p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`t_${locale}`} className="font-mono">
                      {locale}
                    </Label>
                    <div className="flex items-center gap-2 text-xs">
                      {v.version ? (
                        <Badge variant="outline" className="font-mono">
                          published v{v.version}
                        </Badge>
                      ) : (
                        <Badge variant="outline">未发布</Badge>
                      )}
                      {v.draftVersion ? (
                        <Badge variant="secondary" className="font-mono">
                          draft v{v.draftVersion}
                        </Badge>
                      ) : null}
                      {!isNew ? (
                        <Button asChild size="sm" variant="link" className="h-auto px-1">
                          <Link
                            to={`/dashboard/${namespace.slug}/entries/${encodeURIComponent(keyParam)}/history?locale=${locale}`}
                          >
                            历史
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Textarea
                    id={`t_${locale}`}
                    name={`t_${locale}`}
                    defaultValue={v.value}
                    rows={2}
                    disabled={!editable}
                  />
                  {!isNew && v.draftVersion ? (
                    <PublishDraftRow
                      slug={namespace.slug}
                      entryKey={keyParam}
                      locale={locale}
                      version={v.draftVersion}
                      editable={editable}
                    />
                  ) : null}
                </div>
              );
            })}
            {editable ? (
              <div className="flex gap-2">
                <Button type="submit" name="asDraft" value="false" disabled={submitting}>
                  保存并发布
                </Button>
                <Button type="submit" variant="outline" name="asDraft" value="true" disabled={submitting}>
                  保存为草稿
                </Button>
              </div>
            ) : null}
            {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function PublishDraftRow({
  slug,
  entryKey,
  locale,
  version,
  editable,
}: {
  slug: string;
  entryKey: string;
  locale: string;
  version: number;
  editable: boolean;
}) {
  const revalidator = useRevalidator();
  if (!editable) return null;
  const call = async (path: 'publish' | 'discard') => {
    const url = `/api/namespaces/${slug}/entries/${encodeURIComponent(entryKey)}/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale, version }),
    });
    if (!res.ok) {
      let msg = `${path} 失败`;
      try {
        const j = (await res.json()) as { message?: string };
        if (j?.message) msg = j.message;
      } catch {
        /* ignore parse error */
      }
      toast.error(msg);
      return;
    }
    toast.success(`${path} 成功`);
    revalidator.revalidate();
  };
  return (
    <div className="mt-2 flex gap-2 text-xs">
      <Button type="button" size="sm" variant="default" onClick={() => void call('publish')}>
        Publish v{version}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void call('discard')}>
        Discard
      </Button>
    </div>
  );
}
