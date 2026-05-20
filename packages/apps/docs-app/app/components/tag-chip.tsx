import { Link } from 'react-router';
import { getTagColor } from '~/lib/tag-colors';

interface TagChipProps {
  name: string;
  href?: string;
  count?: number;
  className?: string;
}

export function TagChip({ name, href, count, className }: TagChipProps) {
  const color = getTagColor(name);
  const classes = [
    'inline-flex max-w-full items-center gap-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
    count === undefined
      ? `rounded-md px-2.5 py-1 text-xs ${color.bg} ${color.text} ${href ? `${color.hover} ${color.hoverText ?? ''}` : ''}`
      : 'rounded-full bg-[var(--color-bg-subtle)]/60 px-2.5 py-1 text-xs text-[var(--color-primary-deep)] hover:bg-[var(--color-primary)]/10',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="truncate">{name}</span>
      {count !== undefined && <span className="text-[var(--color-text-muted)]">{count}</span>}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
