import * as React from 'react';
import { useFetcher, useLoaderData, Form, useActionData, useNavigation, useOutletContext } from 'react-router';
import { toast } from 'sonner';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { redirect } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceLocales, updateNamespace, deleteNamespace } from '~/lib/services/namespace.server';
import { listEnabledLocales } from '~/lib/services/locale.server';
import { listApiTokens, createApiToken, revokeApiToken } from '~/lib/api-token.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { LocaleMultiSelect, type LocaleOption } from '~/components/locale-multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

import type { Route } from './+types/dashboard.$slug.settings';
import type { NsContext } from './dashboard.$slug';

type TokenScope = 'task' | 'readonly' | 'write';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
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
    tokens: listApiTokens(ctx.namespace.id),
    localeOptions,
    isSuperuser: ctx.user.isSuperuser,
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
      if (e instanceof Response) {
        try {
          const body = (await e.clone().json()) as { message?: string };
          if (body?.message) return { error: body.message };
        } catch {
          /* ignore */
        }
        throw e;
      }
      return { error: e instanceof Error ? e.message : 'update failed' };
    }
  }
  if (intent === 'create-token') {
    const name = String(form.get('tokenName') ?? '');
    const scope = String(form.get('scope') ?? 'task') as TokenScope;
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
    throw redirect('/dashboard');
  }
  return { error: 'unknown intent' };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Settings · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export default function SettingsPage() {
  useOutletContext<NsContext>();
  const { namespace, locales, tokens, localeOptions, isSuperuser } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(locales);
  const [defaultLocale, setDefaultLocale] = React.useState<string>(namespace.defaultLocale);
  const [publicRead, setPublicRead] = React.useState<boolean>(namespace.publicRead);
  const [tokenScope, setTokenScope] = React.useState<TokenScope>('task');
  const lastErrorRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedLocales.length === 0) return;
    if (!selectedLocales.includes(defaultLocale)) {
      setDefaultLocale(selectedLocales[0]!);
    }
  }, [selectedLocales, defaultLocale]);

  React.useEffect(() => {
    setSelectedLocales(locales);
    setDefaultLocale(namespace.defaultLocale);
    setPublicRead(namespace.publicRead);
  }, [locales, namespace.defaultLocale, namespace.publicRead]);

  React.useEffect(() => {
    if (!actionData) return;
    if ('error' in actionData && actionData.error && actionData.error !== lastErrorRef.current) {
      lastErrorRef.current = actionData.error;
      toast.error(actionData.error);
    } else if ('ok' in actionData && actionData.ok && navigation.state === 'idle') {
      toast.success('已保存');
      lastErrorRef.current = null;
    }
  }, [actionData, navigation.state]);

  const newTokenPlaintext =
    fetcher.data && typeof fetcher.data === 'object' && 'plaintext' in fetcher.data
      ? (fetcher.data as { plaintext: string }).plaintext
      : null;

  const copyToken = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败,请手动选择');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground">
          管理 <span className="font-mono">{namespace.slug}</span> 的基本信息、API token 与高危操作。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
          <CardDescription>语言列表的修改会触发 bundleVersion 递增并影响客户端 snapshot 缓存。</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid gap-4">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="defaultLocale" value={defaultLocale} />
            <input type="hidden" name="publicRead" value={String(publicRead)} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">名称</Label>
                <Input id="name" name="name" defaultValue={namespace.name} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug">Slug(不可变)</Label>
                <Input id="slug" value={namespace.slug} disabled className="font-mono" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>语言列表</Label>
              <LocaleMultiSelect
                value={selectedLocales}
                onChange={setSelectedLocales}
                options={localeOptions}
                name="locales"
                minSelected={1}
                isSuperuser={isSuperuser}
              />
              <p className="text-xs text-muted-foreground">
                已被翻译版本引用的语言不可移除;
                {isSuperuser ? '可在「语言库」管理页扩充字典' : '联系系统管理员可扩充字典'}。
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="defaultLocale">默认语言</Label>
              <Select value={defaultLocale} onValueChange={setDefaultLocale} disabled={selectedLocales.length === 0}>
                <SelectTrigger id="defaultLocale" className="w-full sm:w-64">
                  <SelectValue placeholder="选择默认语言" />
                </SelectTrigger>
                <SelectContent>
                  {selectedLocales.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">public_read</span>
                <span className="text-xs text-muted-foreground">
                  允许匿名读 <span className="font-mono">/snapshot/{namespace.slug}</span>
                </span>
              </div>
              <Switch checked={publicRead} onCheckedChange={setPublicRead} />
            </div>
            {actionData && 'error' in actionData && actionData.error ? (
              <p className="text-sm text-destructive">{actionData.error}</p>
            ) : null}
            <div>
              <Button type="submit">保存</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Tokens</CardTitle>
          <CardDescription>
            task token 用于 worker 拉取/回写;readonly token 用于 snapshot 通道;write token 用于脚本写入文案。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form method="post" className="grid items-end gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input type="hidden" name="intent" value="create-token" />
            <input type="hidden" name="scope" value={tokenScope} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tokenName">名称</Label>
              <Input id="tokenName" name="tokenName" required placeholder="e.g. translator-bot" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scope">Scope</Label>
              <Select value={tokenScope} onValueChange={(v) => setTokenScope(v as TokenScope)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">task</SelectItem>
                  <SelectItem value="readonly">readonly</SelectItem>
                  <SelectItem value="write">write（写入文案）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <KeyRound className="size-4" /> 生成
            </Button>
          </Form>

          {newTokenPlaintext ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">⚠️ 仅展示一次,请立即复制保存:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background px-2 py-1.5 font-mono text-xs">
                  {newTokenPlaintext}
                </code>
                <Button type="button" size="sm" variant="outline" onClick={() => copyToken(newTokenPlaintext)}>
                  <Copy className="size-3.5" /> 复制
                </Button>
              </div>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>scope</TableHead>
                <TableHead>name</TableHead>
                <TableHead>prefix</TableHead>
                <TableHead>created</TableHead>
                <TableHead>status</TableHead>
                <TableHead className="w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无 token
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={t.scope === 'task' ? 'default' : 'secondary'}>{t.scope}</Badge>
                    </TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.tokenPrefix}…</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.revokedAt ? 'outline' : 'success'}>{t.revokedAt ? 'revoked' : 'active'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!t.revokedAt ? (
                        <fetcher.Form method="post" className="inline">
                          <input type="hidden" name="intent" value="revoke-token" />
                          <input type="hidden" name="tokenId" value={t.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            撤销
                          </Button>
                        </fetcher.Form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>删除命名空间会级联清理所有词条 / 翻译 / 历史 / 成员 / token / 任务。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-4" /> 删除命名空间
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除命名空间 {namespace.slug}?</DialogTitle>
            <DialogDescription>
              将级联删除所有词条、翻译、版本历史、成员、API token、翻译任务,操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              取消
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <Button type="submit" variant="destructive">
                确认删除
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
