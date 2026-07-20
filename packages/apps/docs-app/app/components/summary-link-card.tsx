import { Link } from 'react-router';

interface SummaryLinkCardProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function SummaryLinkCard({ to, children, className }: SummaryLinkCardProps) {
  const classNames = [
    'glass-card group block p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
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
