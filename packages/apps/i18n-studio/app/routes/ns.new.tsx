import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';

import { requireUser } from '~/lib/auth.server';
import { createNamespace, DEFAULT_LOCALES } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/ns.new';

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const slug = String(form.get('slug') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const localesRaw = String(form.get('locales') ?? '').trim();
  if (!slug || !name) return { error: 'slug 与 name 必填' };
  const locales = localesRaw
    ? localesRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_LOCALES;
  try {
    const ns = createNamespace({ slug, name, locales, createdBy: user.id });
    throw redirect(`/ns/${ns.slug}`);
  } catch (e) {
    if (e instanceof Response) throw e;
    return { error: e instanceof Error ? e.message : '创建失败' };
  }
}

export default function NewNamespacePage() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  return (
    <main className="container mx-auto p-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← 返回
      </Link>
      <Card className="mx-auto mt-6 max-w-md">
        <CardHeader>
          <CardTitle>新建命名空间</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex flex-col gap-3">
            <div>
              <Label htmlFor="slug">slug</Label>
              <Input id="slug" name="slug" placeholder="docs" required pattern="[a-z0-9][a-z0-9_-]*" />
            </div>
            <div>
              <Label htmlFor="name">名称</Label>
              <Input id="name" name="name" placeholder="Documentation" required />
            </div>
            <div>
              <Label htmlFor="locales">语言列表(逗号分隔)</Label>
              <Input id="locales" name="locales" placeholder="zh-cn,zh-tw,en-us" defaultValue="zh-cn,zh-tw,en-us" />
            </div>
            {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? '创建中…' : '创建'}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
