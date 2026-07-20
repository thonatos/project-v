import type { Route } from './+types/blog._index';
import { getDocsByType, getGraphData } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { PageShell } from '~/components/page-shell';
import { PageHeader } from '~/components/page-header';
import { HeroGraph } from '~/components/hero-graph';

export function meta() {
  return [{ title: 'ρV - Blog' }, { name: 'description', content: '博客文章列表' }];
}

export async function loader() {
  const [docs, graph] = await Promise.all([getDocsByType('blog'), getGraphData()]);
  return { docs, graph };
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { docs, graph } = loaderData;

  return (
    <PageShell width="contained">
      {/* 全宽 WebGL 图谱背景（客户端增强，可降级为无） */}
      <HeroGraph data={graph} />

      <PageHeader title="Blog" description={`共 ${docs.length} 篇文章`} />

      {docs.length > 0 ? (
        <div className="glass-card flex flex-col gap-8 p-6 sm:p-8 [&>article:last-child]:border-b-0 [&>article:last-child]:pb-0">
          {docs.map((doc) => (
            <ArticleCard
              key={doc.slug}
              variant="list"
              href={`/docs/${doc.slug}`}
              title={doc.title}
              date={doc.date}
              description={doc.description}
              tags={doc.tags}
            />
          ))}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无文章</p>
      )}
    </PageShell>
  );
}
