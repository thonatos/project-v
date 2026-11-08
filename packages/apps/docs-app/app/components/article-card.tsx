import { Link } from 'react-router';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  eyebrow?: string;
  variant?: 'grid' | 'list' | 'compact';
}

export function ArticleCard({ href, title, date, description, eyebrow, variant = 'list' }: ArticleCardProps) {
  return (
    <article className={`content-entry content-entry-${variant}`}>
      <Link to={href} className="content-entry-link">
        <div className="content-entry-meta">
          {eyebrow && <span>{eyebrow}</span>}
          <time dateTime={date}>{date}</time>
        </div>
        <div className="min-w-0">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="content-entry-arrow" aria-hidden="true">
          ↗
        </span>
      </Link>
    </article>
  );
}
