import { Link } from 'react-router';
import type { Route } from './+types/docs.$slug';
import { getDocBySlug } from '~/lib/docs';
import { DocLayout } from '~/components/doc-layout';
import { TagChip } from '~/components/tag-chip';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  if (!doc) {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `ρV - ${data.title}` }, { name: 'description', content: data.description }];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  return (
    <DocLayout toc={loaderData.toc}>
      <header className="doc-header-card">
        <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{loaderData.date}</time>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">{loaderData.title}</h1>
        {loaderData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {loaderData.tags.map((tag) => (
              <TagChip key={tag} name={tag} href={`/tags/${tag}`} />
            ))}
          </div>
        )}
      </header>

      <article className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: loaderData.content }} />
      </article>
    </DocLayout>
  );
}

export function ErrorBoundary() {
  console.error('Error loading document');
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">文档加载失败</h1>
        <p className="text-[var(--color-text-muted)] mb-8">抱歉，无法加载此文档</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
