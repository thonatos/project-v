import type { TagInfo } from '~/lib/docs';
import { SummaryLinkCard } from './summary-link-card';
import { TagChip } from './tag-chip';

interface TagSummaryCardProps {
  tag: TagInfo;
}

export function TagSummaryCard({ tag }: TagSummaryCardProps) {
  return (
    <SummaryLinkCard to={`/tags/${tag.name}`}>
      <div className="flex items-start justify-between gap-3">
        <TagChip name={tag.name} className="text-sm" />
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-[var(--color-text-muted)] ring-1 ring-[var(--color-border-subtle)]">
          {tag.count} 篇
        </span>
      </div>
    </SummaryLinkCard>
  );
}
