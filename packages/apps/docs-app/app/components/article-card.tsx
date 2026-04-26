import { Link } from 'react-router';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
}

export function ArticleCard({ href, title, date, description }: ArticleCardProps) {
  return (
    <article className="group border-b border-[var(--color-border)] pb-8">
      <Link to={href} className="block">
        {/* Date */}
        <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{date}</time>

        {/* Title */}
        <h2 className="text-xl font-semibold mb-3 group-hover:text-[var(--color-primary)] transition-colors">
          {title}
        </h2>

        {/* Description */}
        <p className="text-[var(--color-text-muted)] line-clamp-2">{description}</p>
      </Link>
    </article>
  );
}
