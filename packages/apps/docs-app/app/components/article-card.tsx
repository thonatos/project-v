import { Link } from 'react-router';
import { SummaryLinkCard } from './summary-link-card';
import { TagChip } from './tag-chip';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  tags?: string[];
  variant?: 'grid' | 'list';
}

export function ArticleCard({ href, title, date, description, tags, variant = 'list' }: ArticleCardProps) {
  if (variant === 'grid') {
    return (
      <SummaryLinkCard to={href}>
        <time className="mb-3 block text-sm text-[var(--color-text-muted)]">{date}</time>
        <h2 className="mb-3 line-clamp-2 text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary-hover)]">
          {title}
        </h2>
        <p className="line-clamp-2 text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
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
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
      >
        {/* Date */}
        <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{date}</time>

        {/* Title */}
        <h2 className="text-xl font-semibold mb-3 text-[var(--color-text)] group-hover:text-[var(--color-primary-hover)]">
          {title}
        </h2>

        {/* Description */}
        <p className="text-[var(--color-text-muted)] line-clamp-2">{description}</p>
      </Link>

      {/* Tags */}
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
