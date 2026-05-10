import type { Route } from './+types/_index';
import { getAllDocs } from '~/lib/docs';
import { ArticleSummaryCard } from '~/components/article-summary-card';

export function meta() {
  return [{ title: 'ρV' }, { name: 'description', content: 'undefined project' }];
}

export async function loader() {
  const docs = await getAllDocs();
  return docs;
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      {/* Hero Section */}
      <header className="mb-12 rounded-lg border border-[var(--color-border-subtle)] bg-transparent p-6 shadow-[inset_0_0_0_1px_rgba(31,41,55,0.06)]">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">ρV</h1>
        <p className="text-lg text-[var(--color-text-muted)]">undefined project</p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loaderData.map((doc) => (
          <ArticleSummaryCard
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            title={doc.title}
            date={doc.date}
            description={doc.description}
            tags={doc.tags}
          />
        ))}
      </div>

      {loaderData.length === 0 && <p className="text-[var(--color-text-muted)] text-center py-12">暂无文档</p>}
    </div>
  );
}
