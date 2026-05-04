import type { Route } from './+types/tags._index';
import { Link } from 'react-router';
import { getAllTags, getAllDocs, type Doc } from '~/lib/docs';
import { getTagColor } from '~/lib/tag-colors';

export function meta() {
  return [{ title: 'ρV - All Tags' }, { name: 'description', content: '所有标签列表' }];
}

export async function loader() {
  const tags = await getAllTags();
  const docs = await getAllDocs();
  return { tags, docs };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
  const { tags, docs } = loaderData;

  // 按标签分组文档
  const docsByTag = new Map<string, Doc[]>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      const existing = docsByTag.get(tag) || [];
      docsByTag.set(tag, [...existing, doc]);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">All Tags</h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          共 {tags.length} 个标签，{docs.length} 篇文档
        </p>
      </header>

      {/* 标签卡片网格 */}
      {tags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map((tag) => {
            const color = getTagColor(tag.name);
            const tagDocs = docsByTag.get(tag.name) || [];

            return (
              <Link
                key={tag.name}
                to={`/tags/${tag.name}`}
                className={`group block p-4 rounded-lg ${color.bg} ${color.hover} ${color.hoverText ?? ''} transition-all border border-transparent hover:border-[var(--color-primary)]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}
              >
                {/* 标签名称和计数 */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-lg font-semibold ${color.text}`}>{tag.name}</h2>
                  <span className="text-sm bg-white/60 px-2 py-1 rounded-full text-[var(--color-text-muted)]">
                    {tag.count} 篇
                  </span>
                </div>

                {/* 最近文档预览 */}
                {tagDocs.length > 0 && (
                  <div className="space-y-2">
                    {tagDocs.slice(0, 2).map((doc) => (
                      <p
                        key={doc.slug}
                        className="text-sm text-[var(--color-text-muted)] truncate group-hover:text-[var(--color-text)]"
                      >
                        {doc.title}
                      </p>
                    ))}
                    {tagDocs.length > 2 && (
                      <p className="text-xs text-[var(--color-text-muted)]">+{tagDocs.length - 2} 更多</p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无标签</p>
      )}
    </div>
  );
}
