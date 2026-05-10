import type { Doc, TagInfo } from '~/lib/docs';
import { getTagColor } from '~/lib/tag-colors';
import { SummaryLinkCard } from './summary-link-card';

interface TagSummaryCardProps {
  tag: TagInfo;
  docs: Doc[];
}

export function TagSummaryCard({ tag, docs }: TagSummaryCardProps) {
  const color = getTagColor(tag.name);
  const previewDocs = docs.slice(0, 2);
  const remainingCount = docs.length - previewDocs.length;

  return (
    <SummaryLinkCard to={`/tags/${tag.name}`}>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex min-w-0 max-w-full items-center rounded-md px-2.5 py-1 text-sm font-medium ${color.bg} ${color.text}`}
        >
          <span className="truncate">{tag.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-[var(--color-text-muted)] ring-1 ring-[var(--color-border-subtle)]">
          {tag.count} 篇
        </span>
      </div>

      {previewDocs.length > 0 && (
        <div className="mt-4 space-y-2">
          {previewDocs.map((doc) => (
            <p
              key={doc.slug}
              className="truncate text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]"
            >
              {doc.title}
            </p>
          ))}
          {remainingCount > 0 && <p className="text-xs text-[var(--color-text-muted)]">+{remainingCount} 更多</p>}
        </div>
      )}
    </SummaryLinkCard>
  );
}
