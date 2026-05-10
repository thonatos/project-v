import { ContentPanel } from './content-panel';
import { LinkedTagPill } from './linked-tag-pill';

interface TagFilterPanelProps {
  title: string;
  tags: Array<{
    name: string;
    count: number;
  }>;
}

export function TagFilterPanel({ title, tags }: TagFilterPanelProps) {
  return (
    <ContentPanel variant="emphasis" className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">{title}</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{tags.length} 个</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <LinkedTagPill key={tag.name} name={tag.name} count={tag.count} />
        ))}
      </div>
    </ContentPanel>
  );
}
