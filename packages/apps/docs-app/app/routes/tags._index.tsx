import type { Route } from './+types/tags._index';
import { getAllTags, getAllDocs, type Doc } from '~/lib/docs';
import { PageHeader } from '~/components/page-header';
import { TagSummaryCard } from '~/components/tag-summary-card';

export function meta() {
  return [{ title: 'ρV - Tags' }, { name: 'description', content: '所有标签列表' }];
}

export async function loader() {
  const [tags, docs] = await Promise.all([getAllTags(), getAllDocs()]);
  return { tags, docs };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
  const { tags, docs } = loaderData;

  const docsByTag = new Map<string, Doc[]>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      const tagDocs = docsByTag.get(tag);
      if (tagDocs) {
        tagDocs.push(doc);
      } else {
        docsByTag.set(tag, [doc]);
      }
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <PageHeader title="Tags" description={`共 ${tags.length} 个标签，${docs.length} 篇文档`} />

      {tags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map((tag) => (
            <TagSummaryCard key={tag.name} tag={tag} docs={docsByTag.get(tag.name) ?? []} />
          ))}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无标签</p>
      )}
    </div>
  );
}
