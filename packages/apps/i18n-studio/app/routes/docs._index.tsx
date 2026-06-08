import { getDocBySlug } from '~/lib/docs';

import type { Route } from './+types/docs._index';

export async function loader() {
  const doc = await getDocBySlug('index');
  if (!doc) {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: 'Not Found · Docs · i18n-studio' }];
  return [{ title: `${data.title} · Docs · i18n-studio` }, { name: 'description', content: data.description }];
}

export default function DocsIndex({ loaderData }: Route.ComponentProps) {
  // HTML 来自 build 期对 app/docs/*.md 的 unified pipeline 编译,内容是版本控制下的可信源,
  // 不引入任何运行时用户输入,因此安全使用 dangerouslySetInnerHTML。
  return (
    <>
      <header className="border-b pb-4 mb-6">
        <h1 className="text-3xl font-semibold">{loaderData.title}</h1>
        {loaderData.description ? <p className="text-muted-foreground mt-2">{loaderData.description}</p> : null}
      </header>
      <div
        className="prose dark:prose-invert max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: loaderData.content }}
      />
    </>
  );
}
