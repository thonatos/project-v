import type { Route } from './+types/tags.$tag';
import { getDocsByTag, getAllTags } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { BasicLayout } from '~/components/basic-layout';
import { PageHeader } from '~/components/page-header';
import { getTagColor } from '~/lib/tag-colors';
import { ContentPanel } from '~/components/content-panel';
import { ArticleListPanel } from '~/components/article-list-panel';
import { TagChip } from '~/components/tag-chip';

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
  const currentTagColor = getTagColor(loaderData.tag);

  return (
    <BasicLayout>
      <PageHeader
        title={`Tag: ${loaderData.tag}`}
        description={`共 ${loaderData.count} 篇文档`}
        backLink={{ to: '/tags', label: '← 返回标签列表' }}
      />

      <ContentPanel variant="emphasis" className="mb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-text-muted)]">当前标签</p>
            <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              #{loaderData.tag}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-medium ${currentTagColor.bg} ${currentTagColor.text}`}
            >
              <span className="truncate">{loaderData.tag}</span>
            </span>
            <span className="rounded-full border border-[var(--color-border-subtle)] px-3 py-1 text-sm text-[var(--color-text-muted)]">
              {loaderData.count} 篇
            </span>
          </div>
        </div>

        {loaderData.relatedTags.length > 0 && (
          <div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--color-text)]">相关标签</h3>
              <span className="text-xs text-[var(--color-text-muted)]">{loaderData.relatedTags.length} 个</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {loaderData.relatedTags.map((tag) => (
                <TagChip key={tag.name} name={tag.name} href={`/tags/${tag.name}`} count={tag.count} />
              ))}
            </div>
          </div>
        )}
      </ContentPanel>

      {loaderData.docs.length > 0 ? (
        <ArticleListPanel count={loaderData.docs.length}>
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
        </ArticleListPanel>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">该标签下暂无文档</p>
      )}
    </BasicLayout>
  );
}
