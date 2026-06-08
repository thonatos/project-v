import * as React from 'react';
import { useLoaderData, useOutletContext } from 'react-router';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { listNamespaces, getNamespaceLocales } from '~/lib/services/namespace.server';
import { listEnabledLocales } from '~/lib/services/locale.server';
import { LocaleMultiSelect, type LocaleOption } from '~/components/locale-multi-select';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';

import type { Route } from './+types/dashboard.$slug.sync';
import type { NsContext } from './dashboard.$slug';

interface SyncResult {
  created?: number;
  updated?: number;
  skipped?: number;
  bundleVersion?: number;
  [k: string]: unknown;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
  const namespaces = listNamespaces(ctx.user.id);
  const enabledLocales = listEnabledLocales();
  const localeOptions: LocaleOption[] = enabledLocales.map((l) => ({
    code: l.code,
    label: l.label,
    englishLabel: l.englishLabel,
    nativeLabel: l.nativeLabel,
  }));
  return {
    namespace: ctx.namespace,
    locales: getNamespaceLocales(ctx.namespace),
    namespaces,
    localeOptions,
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Sync · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

type Strategy = 'fill_missing' | 'overwrite' | 'skip';

export default function SyncPage() {
  useOutletContext<NsContext>();
  const { namespace, locales, namespaces, localeOptions } = useLoaderData<typeof loader>();

  const [sourceSlug, setSourceSlug] = React.useState('');
  const [prefix, setPrefix] = React.useState('');
  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(locales);
  const [strategy, setStrategy] = React.useState<Strategy>('fill_missing');
  const [autoPublish, setAutoPublish] = React.useState(false);
  const [dryRun, setDryRun] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<SyncResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const sourceCandidates = namespaces.filter((n) => n.slug !== namespace.slug);

  const submit = async (mode: 'preview' | 'apply') => {
    if (!sourceSlug) {
      toast.warning('请选择源命名空间');
      return;
    }
    if (selectedLocales.length === 0) {
      toast.warning('请至少选择一个 locale');
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/namespaces/${namespace.slug}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSlug,
          prefix: prefix || undefined,
          locales: selectedLocales,
          strategy,
          autoPublish,
          dryRun: mode === 'preview' ? true : dryRun,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`${res.status}: ${txt}`);
        toast.error(`同步失败: ${res.status}`);
      } else {
        const j = (await res.json()) as SyncResult;
        setResult(j);
        toast.success(mode === 'preview' ? '预览完成' : '同步完成');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">跨空间同步</h1>
        <p className="text-sm text-muted-foreground">
          从源命名空间向当前命名空间 <span className="font-mono">{namespace.slug}</span> 拉取词条。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步参数</CardTitle>
          <CardDescription>选择源 / 范围 / 策略后,先 dry-run 预览,再决定是否写入。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sourceSlug">源命名空间</Label>
              <Select value={sourceSlug} onValueChange={setSourceSlug}>
                <SelectTrigger id="sourceSlug">
                  <SelectValue placeholder="— 选择 —" />
                </SelectTrigger>
                <SelectContent>
                  {sourceCandidates.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      暂无其它命名空间
                    </SelectItem>
                  ) : (
                    sourceCandidates.map((n) => (
                      <SelectItem key={n.id} value={n.slug}>
                        {n.name} <span className="ml-2 font-mono text-xs text-muted-foreground">{n.slug}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prefix">Prefix(可选)</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="home."
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Locales</Label>
            <LocaleMultiSelect value={selectedLocales} onChange={setSelectedLocales} options={localeOptions} />
            <p className="text-xs text-muted-foreground">本命名空间已启用:{locales.join(' · ')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strategy">策略</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
              <SelectTrigger id="strategy" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fill_missing">fill_missing — 仅补齐缺失</SelectItem>
                <SelectItem value="overwrite">overwrite — 全量覆盖</SelectItem>
                <SelectItem value="skip">skip — 已存在则跳过</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">auto_publish</div>
                <p className="text-xs text-muted-foreground">写入即生效,不进入 draft</p>
              </div>
              <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">dry_run</div>
                <p className="text-xs text-muted-foreground">仅返回计划,不写入</p>
              </div>
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit('preview')}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              预览(dry-run)
            </Button>
            <Button type="button" disabled={pending} onClick={() => submit('apply')}>
              应用
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">结果</CardTitle>
            <CardDescription>
              created={result.created ?? 0} · updated={result.updated ?? 0} · skipped={result.skipped ?? 0}
              {result.bundleVersion ? ` · bundle v${result.bundleVersion}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
              <code>{JSON.stringify(result, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
