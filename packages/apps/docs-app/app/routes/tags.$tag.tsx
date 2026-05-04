import type { Route } from './+types/tags.$tag';
import { Link } from 'react-router';
import { getDocsByTag, getAllTags } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `ρV - 标签: ${data.tag}` }, { name: 'description', content: `${data.tag} 标签下的文档` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const tag = params.tag;
  const docs = await getDocsByTag(tag);
  const allTags = await getAllTags();
  const tagInfo = allTags.find((t) => t.name === tag);

  return {
    tag,
    docs,
    count: tagInfo?.count || 0,
  };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/tags"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
          >
            ← 返回标签列表
          </Link>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">
          标签: {loaderData.tag}
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">共 {loaderData.count} 篇文档</p>
      </header>

      {loaderData.docs.length > 0 ? (
        <div className="space-y-8">
          {loaderData.docs.map((doc) => (
            <ArticleCard
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              title={doc.title}
              date={doc.date}
              description={doc.description}
              tags={doc.tags}
            />
          ))}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">该标签下暂无文档</p>
      )}
    </div>
  );
}
