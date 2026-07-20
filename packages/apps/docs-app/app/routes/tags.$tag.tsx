import { Link } from 'react-router';
import type { Route } from './+types/tags.$tag';
import { getDocsByTag, getAllTags } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { BasicLayout } from '~/components/basic-layout';
import { TagChip } from '~/components/tag-chip';
import { getTagColor } from '~/lib/tag-colors';

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `ρV - 标签: ${data.tag}` }, { name: 'description', content: `${data.tag} 标签下的文档` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const tag = params.tag;
  const docs = await getDocsByTag(tag);
  const allTags = await getAllTags();
  const tagInfo = allTags.find((t) => t.name === tag);
  const relatedTagCounts = new Map<string, number>();

  for (const doc of docs) {
    for (const docTag of doc.tags) {
      if (docTag !== tag) {
        relatedTagCounts.set(docTag, (relatedTagCounts.get(docTag) || 0) + 1);
      }
    }
  }

  const relatedTags = Array.from(relatedTagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    tag,
    docs,
    count: tagInfo?.count || 0,
    relatedTags,
  };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { tag, docs, count, relatedTags } = loaderData;
  const color = getTagColor(tag);

  return (
    <BasicLayout>
      <header className="mb-10 border-b border-[var(--color-border-subtle)] pb-6">
        <Link
          to="/tags"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          ← 返回标签列表
        </Link>

        <h1 className="mt-4 flex items-baseline gap-3 text-3xl font-bold tracking-tight text-[var(--color-text)]">
          <span className={color.text}>#</span>
          <span className="min-w-0 break-words">{tag}</span>
          <span className="text-base font-normal text-[var(--color-text-muted)]">{count} 篇</span>
        </h1>

        {relatedTags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-[var(--color-text-muted)]">相关标签</span>
            {relatedTags.map((related) => (
              <TagChip key={related.name} name={related.name} href={`/tags/${related.name}`} count={related.count} />
            ))}
          </div>
        )}
      </header>

      {docs.length > 0 ? (
        <div className="flex flex-col gap-8">
          {docs.map((doc) => (
            <ArticleCard
              key={doc.slug}
              variant="list"
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
    </BasicLayout>
  );
}
