import { useState } from 'react';
import { useLoaderData } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { listNamespaces, getNamespaceLocales } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

import type { Route } from './+types/ns.$slug.sync';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
  // 列出当前用户参与的所有命名空间(用作源/目标候选)
  const namespaces = listNamespaces(ctx.user.id);
  return {
    namespace: ctx.namespace,
    locales: getNamespaceLocales(ctx.namespace),
    namespaces,
  };
}

export default function SyncPage() {
  const { namespace, locales, namespaces } = useLoaderData<typeof loader>();
  const [result, setResult] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      sourceSlug: String(fd.get('sourceSlug') ?? ''),
      prefix: String(fd.get('prefix') ?? '') || undefined,
      locales: String(fd.get('locales') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      strategy: String(fd.get('strategy') ?? 'fill_missing') as 'skip' | 'overwrite' | 'fill_missing',
      autoPublish: fd.get('autoPublish') === 'true',
      dryRun: fd.get('dryRun') === 'true',
    };
    try {
      const res = await fetch(`/api/namespaces/${namespace.slug}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`${res.status}: ${txt}`);
      } else {
        setResult(await res.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">跨空间同步(写入当前命名空间)</h1>
      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
        <div>
          <Label>源命名空间</Label>
          <select name="sourceSlug" required className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">— 选择 —</option>
            {namespaces
              .filter((n) => n.slug !== namespace.slug)
              .map((n) => (
                <option key={n.id} value={n.slug}>
                  {n.slug}
                </option>
              ))}
          </select>
        </div>
        <div>
          <Label>Prefix(可选)</Label>
          <Input name="prefix" placeholder="home." />
        </div>
        <div>
          <Label>Locales(逗号分隔,目标已启用:{locales.join(',')})</Label>
          <Input name="locales" placeholder="zh-cn,en-us" required />
        </div>
        <div>
          <Label>策略</Label>
          <select name="strategy" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="fill_missing">fill_missing</option>
            <option value="overwrite">overwrite</option>
            <option value="skip">skip</option>
          </select>
        </div>
        <Label className="flex items-center gap-2">
          <input type="checkbox" name="autoPublish" value="true" />
          auto_publish(写入即生效,不进入 draft)
        </Label>
        <div className="flex gap-2">
          <Button type="submit" name="dryRun" value="true" variant="outline" disabled={pending}>
            预览(dry-run)
          </Button>
          <Button type="submit" name="dryRun" value="false" disabled={pending}>
            应用
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <pre className="rounded-md border bg-muted p-3 text-xs">
          <code>{JSON.stringify(result, null, 2)}</code>
        </pre>
      ) : null}
    </div>
  );
}
