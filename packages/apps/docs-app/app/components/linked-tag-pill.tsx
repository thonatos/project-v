import { Link } from 'react-router';

interface LinkedTagPillProps {
  name: string;
  count: number;
}

export function LinkedTagPill({ name, count }: LinkedTagPillProps) {
  return (
    <Link
      to={`/tags/${name}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)]/60 px-2.5 py-1 text-xs font-medium text-[var(--color-primary-deep)] transition-colors hover:bg-[var(--color-primary)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    >
      <span className="truncate">{name}</span>
      <span className="text-[var(--color-text-muted)]">{count}</span>
    </Link>
  );
}
