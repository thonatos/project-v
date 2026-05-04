import { Link } from 'react-router';
import { TagBadge } from './tag-badge';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  tags?: string[];
}

export function ArticleCard({ href, title, date, description, tags }: ArticleCardProps) {
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
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}
