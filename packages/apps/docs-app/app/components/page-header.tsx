import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  description: string;
  backLink?: {
    to: string;
    label: string;
  };
  children?: React.ReactNode;
}

export function PageHeader({ title, description, backLink, children }: PageHeaderProps) {
  return (
    <header className="mb-12">
      {backLink && (
        <div className="mb-4">
          <Link
            to={backLink.to}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            {backLink.label}
          </Link>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">{title}</h1>
          <p className="text-lg text-[var(--color-text-muted)]">{description}</p>
        </div>

        {children}
      </div>
    </header>
  );
}
