import type { Route } from './+types/_index';
import { getAllDocs } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';

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
      <header className="mb-16">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-primary)]">ρV</h1>
        <p className="text-lg text-[var(--color-text-muted)]">undefined project</p>
      </header>

      {/* Articles List */}
      <div className="space-y-8">
        {loaderData.map((doc) => (
          <ArticleCard
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            title={doc.title}
            date={doc.date}
            description={doc.description}
          />
        ))}
      </div>

      {loaderData.length === 0 && <p className="text-[var(--color-text-muted)] text-center py-12">暂无文档</p>}
    </div>
  );
}
