import { Link } from 'react-router';

interface SummaryLinkCardProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function SummaryLinkCard({ to, children, className }: SummaryLinkCardProps) {
  const classNames = [
    'group block rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)]/80 p-4 transition-colors hover:border-[var(--color-primary)]/30 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link to={to} className={classNames}>
      {children}
    </Link>
  );
}
