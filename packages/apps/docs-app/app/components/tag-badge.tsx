import { Link } from 'react-router';
import { getTagColor } from '~/lib/tag-colors';

interface TagBadgeProps {
  tag: string;
}

export function TagBadge({ tag }: TagBadgeProps) {
  const color = getTagColor(tag);

  return (
    <Link
      to={`/tags/${tag}`}
      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md ${color.bg} ${color.text} ${color.hover} ${color.hoverText ?? ''} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}
    >
      {tag}
    </Link>
  );
}
