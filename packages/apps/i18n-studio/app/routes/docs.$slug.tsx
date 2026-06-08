import { Link } from 'react-router';

import { getDocBySlug } from '~/lib/docs';

import type { Route } from './+types/docs.$slug';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  if (!doc) {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: 'Not Found · Docs · i18n-studio' }];
  return [{ title: `${data.title} · Docs · i18n-studio` }, { name: 'description', content: data.description }];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  // HTML 来自 build 期对 app/docs/*.md 的 unified pipeline 编译,
  // 内容是版本控制下的可信源,不接受任何运行时用户输入。
  const safeHtml = { __html: loaderData.content };
  return (
    <>
      <header className="border-b pb-4 mb-6">
        <h1 className="text-3xl font-semibold">{loaderData.title}</h1>
        {loaderData.description ? <p className="text-muted-foreground mt-2">{loaderData.description}</p> : null}
      </header>
      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={safeHtml} />
    </>
  );
}

export function ErrorBoundary() {
  return (
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold mb-4">文档不存在</h1>
      <Link to="/docs" className="text-primary hover:underline">
        返回文档首页
      </Link>
    </div>
  );
}
