import { Link } from 'react-router';
import type { TagInfo } from '~/lib/docs';

interface TagCloudProps {
  tags: TagInfo[];
}

// Map a tag's article count to a size tier relative to the max count in the set.
// Returns Tailwind classes for font-size / weight / color so higher-frequency
// tags read as visually heavier.
function tierClasses(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0;
  if (ratio >= 0.75) {
    return 'text-2xl font-bold text-[var(--color-primary-deep)]';
  }
  if (ratio >= 0.5) {
    return 'text-xl font-semibold text-[var(--color-primary)]';
  }
  if (ratio >= 0.25) {
    return 'text-lg font-medium text-[var(--color-text)]';
  }
  return 'text-base font-normal text-[var(--color-text-muted)]';
}

export function TagCloud({ tags }: TagCloudProps) {
  const max = tags.reduce((m, t) => Math.max(m, t.count), 0);

  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
      {tags.map((tag) => (
        <Link
          key={tag.name}
          to={`/tags/${tag.name}`}
          className={`inline-flex items-baseline gap-1 leading-none transition-colors hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${tierClasses(
            tag.count,
            max,
          )}`}
        >
          {tag.name}
          <span className="text-xs font-normal text-[var(--color-text-muted)]">{tag.count}</span>
        </Link>
      ))}
    </div>
  );
}
