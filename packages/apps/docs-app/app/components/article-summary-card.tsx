import { getTagColor } from '~/lib/tag-colors';
import { SummaryLinkCard } from './summary-link-card';

interface ArticleSummaryCardProps {
  href: string;
  title: string;
  date: string;
  description: string;
  tags?: string[];
}

export function ArticleSummaryCard({ href, title, date, description, tags }: ArticleSummaryCardProps) {
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
          {tags.slice(0, 4).map((tag) => {
            const color = getTagColor(tag);

            return (
              <span
                key={tag}
                className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-medium ${color.bg} ${color.text}`}
              >
                <span className="truncate">{tag}</span>
              </span>
            );
          })}
          {tags.length > 4 && <span className="text-xs text-[var(--color-text-muted)]">+{tags.length - 4}</span>}
        </div>
      )}
    </SummaryLinkCard>
  );
}
