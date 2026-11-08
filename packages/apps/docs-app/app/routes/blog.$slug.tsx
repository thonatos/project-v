import { Link } from 'react-router';
import type { Route } from './+types/blog.$slug';
import { ArticleLayout } from '~/components/article-layout';
import { getBlogCategoryLabel } from '~/lib/content';
import { getDocBySlug } from '~/lib/docs';
import { pageTitle } from '~/lib/seo';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  if (!doc || doc.type !== 'blog') {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: pageTitle(loaderData?.title ?? '文章', 'Blog') },
    { name: 'description', content: loaderData?.description ?? '' },
  ];
}

export default function BlogArticle({ loaderData }: Route.ComponentProps) {
  return (
    <ArticleLayout toc={loaderData.toc} layout={loaderData.layout}>
      <header className="article-header">
        <Link className="section-kicker text-link" to={`/blog?category=${loaderData.category}`}>
          {getBlogCategoryLabel(loaderData.category)}
        </Link>
        <h1>{loaderData.title}</h1>
        <p className="article-deck">{loaderData.description}</p>
        <time dateTime={loaderData.date}>{loaderData.date}</time>
      </header>
      <article className="prose max-w-none">
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: loaderData.content }} />
      </article>
      <footer className="article-end">
        <Link className="text-link" to="/blog">
          ← 返回 Blog
        </Link>
      </footer>
    </ArticleLayout>
  );
}

export function ErrorBoundary() {
  return <PageNotFound />;
}

function PageNotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center">
        <p className="section-kicker">404</p>
        <h1 className="mt-3 text-3xl font-semibold">没有找到这篇 Blog</h1>
        <Link className="text-link mt-6 inline-block" to="/blog">
          返回 Blog →
        </Link>
      </div>
    </div>
  );
}
