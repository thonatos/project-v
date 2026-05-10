import type { Route } from './+types/trading._index';
import { getAllDocs } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { PageHeader } from '~/components/page-header';
import { TagFilterPanel } from '~/components/tag-filter-panel';
import { ArticleListPanel } from '~/components/article-list-panel';

// Trading 相关标签
const TRADING_TAGS = [
  'trading',
  'investment',
  'stock-analysis',
  'tesla',
  'ev',
  'ai',
  'technical-analysis',
  'price-action',
  'tutorial',
  'tradingview',
];

export function meta() {
  return [{ title: 'ρV - Trading' }, { name: 'description', content: '交易相关文档' }];
}

export async function loader() {
  const allDocs = await getAllDocs();
  // 筛选包含交易相关标签的文档
  const docs = allDocs.filter((doc) => doc.tags.some((tag) => TRADING_TAGS.includes(tag)));
  return { docs };
}

export default function TradingIndex({ loaderData }: Route.ComponentProps) {
  const { docs } = loaderData;

  // 统计各标签出现次数
  const tagCounts = new Map<string, number>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      if (TRADING_TAGS.includes(tag)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }
  const categoryTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <PageHeader
        title="Trading"
        description={`投资、交易、市场分析相关文档，共 ${docs.length} 篇`}
        backLink={{ to: '/', label: '← 返回首页' }}
      />

      {categoryTags.length > 0 && <TagFilterPanel title="标签列表" tags={categoryTags} />}

      {docs.length > 0 ? (
        <ArticleListPanel count={docs.length}>
          {docs.map((doc) => (
            <ArticleCard
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              title={doc.title}
              date={doc.date}
              description={doc.description}
              tags={doc.tags}
            />
          ))}
        </ArticleListPanel>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无交易相关文档</p>
      )}
    </div>
  );
}
