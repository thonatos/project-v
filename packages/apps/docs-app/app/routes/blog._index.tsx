import { Link, useSearchParams } from 'react-router';
import type { Route } from './+types/blog._index';
import { ArticleCard } from '~/components/article-card';
import { BlogShell } from '~/components/blog-shell';
import { BLOG_CATEGORIES, getBlogCategoryLabel, type BlogCategory } from '~/lib/content';
import { getDocsByType } from '~/lib/docs';
import { pageTitle } from '~/lib/seo';

export function meta() {
  return [{ title: pageTitle('Blog') }, { name: 'description', content: '用于发布文章与记录观点。' }];
}

export async function loader() {
  return { docs: await getDocsByType('blog') };
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category');
  const category = BLOG_CATEGORIES.some((item) => item.value === requestedCategory)
    ? (requestedCategory as BlogCategory)
    : null;
  const docs = category ? loaderData.docs.filter((doc) => doc.category === category) : loaderData.docs;

  return (
    <BlogShell>
      <header className="page-intro">
        <h1>Blog</h1>
        <p>用于发布文章与记录观点。</p>
      </header>
      <nav className="category-tabs" aria-label="Blog 栏目">
        <Link to="/blog" aria-current={category === null ? 'page' : undefined}>
          全部 <span>{loaderData.docs.length}</span>
        </Link>
        {BLOG_CATEGORIES.map((item) => (
          <Link
            key={item.value}
            to={`/blog?category=${item.value}`}
            aria-current={category === item.value ? 'page' : undefined}
          >
            {item.label} <span>{loaderData.docs.filter((doc) => doc.category === item.value).length}</span>
          </Link>
        ))}
      </nav>
      <div className="content-list blog-stream">
        {docs.length > 0 ? (
          docs.map((doc) => (
            <ArticleCard
              key={doc.slug}
              href={doc.href}
              title={doc.title}
              date={doc.date}
              description={doc.description}
              eyebrow={getBlogCategoryLabel(doc.category)}
            />
          ))
        ) : (
          <p className="empty-state">这个栏目还没有文章。</p>
        )}
      </div>
    </BlogShell>
  );
}
