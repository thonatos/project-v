import type { TagInfo } from '~/lib/docs';
import { getTagColor } from '~/lib/tag-colors';
import { SummaryLinkCard } from './summary-link-card';

interface TagSummaryCardProps {
  tag: TagInfo;
}

export function TagSummaryCard({ tag }: TagSummaryCardProps) {
  const color = getTagColor(tag.name);

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
    </SummaryLinkCard>
  );
}
