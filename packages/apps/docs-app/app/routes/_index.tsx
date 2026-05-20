import type { Route } from './+types/_index';
import { getAllDocs } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { BasicLayout } from '~/components/basic-layout';

export function meta() {
  return [{ title: 'ρV' }, { name: 'description', content: 'undefined project' }];
}

export async function loader() {
  const docs = await getAllDocs();
  return docs;
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return (
    <BasicLayout>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loaderData.map((doc) => (
          <ArticleCard
            key={doc.slug}
            variant="grid"
            href={`/docs/${doc.slug}`}
            title={doc.title}
            date={doc.date}
            description={doc.description}
            tags={doc.tags}
          />
        ))}
      </div>

      {loaderData.length === 0 && <p className="text-[var(--color-text-muted)] text-center py-12">暂无文档</p>}
    </BasicLayout>
  );
}
