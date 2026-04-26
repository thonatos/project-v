import { Link } from 'react-router';
import { cn } from '~/lib/utils';

interface ArticleCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  image?: string;
  featured?: boolean;
}

export function ArticleCard({ href, title, date, description, image, featured }: ArticleCardProps) {
  return (
    <article className="group relative">
      <Link
        to={href}
        className={cn(
          'block w-full',
          featured ? 'flex flex-col sm:flex-row gap-4 sm:gap-6' : '',
        )}
      >
        {/* Article Image - Tailwind Blog style */}
        {image && (
          <div className={cn(
            'relative overflow-hidden rounded-lg',
            featured ? 'sm:w-64 sm:h-40 w-full h-48' : 'hidden'
          )}>
            <img
              src={image}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* Article Content */}
        <div className={cn('flex-1', featured ? '' : 'py-4')}>
          {/* Date */}
          <time className="text-sm text-[var(--color-text-muted)] mb-1 block">
            {date}
          </time>

          {/* Title */}
          <h2 className={cn(
            'font-semibold mb-2',
            featured ? 'text-xl sm:text-2xl' : 'text-lg',
            'group-hover:text-[var(--color-primary)] transition-colors'
          )}>
            {title}
          </h2>

          {/* Description */}
          <p className={cn(
            'text-[var(--color-text-muted)] line-clamp-2',
            featured ? 'text-base' : 'text-sm'
          )}>
            {description}
          </p>
        </div>
      </Link>

      {/* Separator line - Tailwind Blog style */}
      {!featured && (
        <div className="border-t border-[var(--color-border)] mt-4" />
      )}
    </article>
  );
}