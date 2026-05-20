import type { Route } from './+types/tags._index';
import { getAllTags } from '~/lib/docs';
import { BasicLayout } from '~/components/basic-layout';
import { PageHeader } from '~/components/page-header';
import { TagSummaryCard } from '~/components/tag-summary-card';

export function meta() {
  return [{ title: 'ρV - All Tags' }, { name: 'description', content: '所有标签列表' }];
}

export async function loader() {
  const tags = await getAllTags();
  return { tags };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
  const { tags } = loaderData;

  return (
    <BasicLayout>
      <PageHeader title="All Tags" description={`共 ${tags.length} 个标签`} />

      {tags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {tags.map((tag) => (
            <TagSummaryCard key={tag.name} tag={tag} />
          ))}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无标签</p>
      )}
    </BasicLayout>
  );
}
