import { Link } from 'react-router';
import { SummaryLinkCard } from './summary-link-card';
import { TagChip } from './tag-chip';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  tags?: string[];
  variant?: 'grid' | 'list' | 'compact';
}

export function ArticleCard({ href, title, date, description, tags, variant = 'list' }: ArticleCardProps) {
  if (variant === 'compact') {
    return (
      <article className="group border-b border-[var(--color-border-subtle)] last:border-b-0">
        <Link
          to={href}
          className="flex flex-col gap-1 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] sm:flex-row sm:gap-6"
        >
          <time className="shrink-0 text-sm text-[var(--color-text-muted)] sm:w-28 sm:pt-0.5">{date}</time>
          <div className="min-w-0">
            <h3 className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary-hover)]">
              {title}
            </h3>
            <p className="mt-1 line-clamp-1 text-sm text-[var(--color-text-muted)]">{description}</p>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'grid') {
    return (
      <SummaryLinkCard to={href} className="relative overflow-hidden">
        {/* 杂志式渐变顶饰 */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 opacity-70"
          style={{ background: 'var(--gradient-brand)' }}
        />
        <time className="mb-3 block text-sm text-[var(--color-text-muted)]">{date}</time>
        <h2 className="mb-3 line-clamp-2 text-lg font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary-hover)]">
          {title}
        </h2>
        <p className="line-clamp-2 text-sm text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]">
          {description}
        </p>

        {tags && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <TagChip key={tag} name={tag} />
            ))}
            {tags.length > 4 && <span className="text-xs text-[var(--color-text-muted)]">+{tags.length - 4}</span>}
          </div>
        )}
      </SummaryLinkCard>
    );
  }

  return (
    <article className="group border-b border-[var(--color-border-subtle)] pb-8">
      <Link
        to={href}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{date}</time>
        <h2 className="text-xl font-semibold mb-3 text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary-hover)]">
          {title}
        </h2>
        <p className="text-[var(--color-text-muted)] line-clamp-2">{description}</p>
      </Link>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <TagChip key={tag} name={tag} href={`/tags/${tag}`} />
          ))}
        </div>
      )}
    </article>
  );
}
