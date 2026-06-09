import * as React from 'react';
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useOutletContext } from 'react-router';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { getUserId, requireUser } from '~/lib/auth.server';
import { createNamespace } from '~/lib/services/namespace.server';
import { listEnabledLocales } from '~/lib/services/locale.server';
import { AppShellHeader } from '~/components/app-shell';
import { LocaleMultiSelect, type LocaleOption } from '~/components/locale-multi-select';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

import type { Route } from './+types/dashboard.new';
import type { DashboardContext } from './dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  // dashboard layout 已 requireUser
  const userId = await getUserId(request);
  if (!userId) throw redirect('/login');
  const enabledLocales = listEnabledLocales();
  const localeOptions: LocaleOption[] = enabledLocales.map((l) => ({
    code: l.code,
    label: l.label,
    englishLabel: l.englishLabel,
    nativeLabel: l.nativeLabel,
  }));
  const defaultSelected = localeOptions.slice(0, 3).map((l) => l.code);
  return { localeOptions, defaultSelected };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const slug = String(form.get('slug') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const localesRaw = String(form.get('locales') ?? '').trim();
  const defaultLocale = String(form.get('defaultLocale') ?? '').trim();
  if (!slug || !name) return { error: 'slug 与 name 必填' };
  const locales = localesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (locales.length === 0) return { error: '至少选择一个语言' };
  if (defaultLocale && !locales.includes(defaultLocale)) {
    return { error: '默认语言必须在已选语言中' };
  }
  try {
    const ns = createNamespace({
      slug,
      name,
      locales,
      defaultLocale: defaultLocale || locales[0],
      createdBy: user.id,
    });
    throw redirect(`/dashboard/${ns.slug}`);
  } catch (e) {
    if (e instanceof Response) {
      // 服务层 jsonError 抛 Response;读取后转成 actionData
      try {
        const body = (await e.clone().json()) as { message?: string };
        if (body?.message) return { error: body.message };
      } catch {
        /* fallthrough redirect */
      }
      throw e;
    }
    return { error: e instanceof Error ? e.message : '创建失败' };
  }
}

export function meta() {
  return [{ title: 'New namespace · i18n-studio' }];
}

export default function NewNamespacePage() {
  const { localeOptions, defaultSelected } = useLoaderData<typeof loader>();
  const { user, theme, lang } = useOutletContext<DashboardContext>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';

  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(defaultSelected);
  const [defaultLocale, setDefaultLocale] = React.useState<string>(defaultSelected[0] ?? '');

  React.useEffect(() => {
    if (selectedLocales.length === 0) {
      setDefaultLocale('');
      return;
    }
    if (!selectedLocales.includes(defaultLocale)) {
      setDefaultLocale(selectedLocales[0]!);
    }
  }, [selectedLocales, defaultLocale]);

  return (
    <div>
      <AppShellHeader
        user={user}
        theme={theme}
        lang={lang}
        crumbs={[{ label: 'Namespaces', to: '/dashboard' }, { label: 'New' }]}
      />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> 返回 Namespaces
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              新建命名空间
            </CardTitle>
            <CardDescription>命名空间是多语言词条管理的隔离单元。slug 全局唯一,创建后不可修改。</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slug">slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="docs"
                    required
                    pattern="[a-z0-9][a-z0-9_-]*"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">小写字母、数字、`-`、`_`,以字母或数字开头</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">名称</Label>
                  <Input id="name" name="name" placeholder="Documentation" required />
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
                  isSuperuser={user.isSuperuser}
                />
                <p className="text-xs text-muted-foreground">
                  从系统语言库中选择;{user.isSuperuser ? '可在「语言库」管理页扩充' : '联系系统管理员可扩充'}。
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
                <input type="hidden" name="defaultLocale" value={defaultLocale} />
              </div>
              {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting ? '创建中…' : '创建命名空间'}
              </Button>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
