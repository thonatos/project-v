import type { Route } from './+types/tech._index';
import { getAllDocs } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { PageHeader } from '~/components/page-header';
import { TagFilterPanel } from '~/components/tag-filter-panel';
import { ArticleListPanel } from '~/components/article-list-panel';

// Technical 相关标签
const TECH_TAGS = [
  'linux',
  'docker',
  'proxy',
  'vpn',
  'network',
  'ssh',
  'firewall',
  'dns',
  'aria2',
  'samba',
  'pve',
  'routeros',
  'wireguard',
  'cloudflare',
  'clash',
  'usb',
  'nftables',
  'virtualization',
  'coredns',
  'security',
  'file-sharing',
  'installation',
  'download',
];

export function meta() {
  return [{ title: 'ρV - Technical' }, { name: 'description', content: '技术相关文档' }];
}

export async function loader() {
  const allDocs = await getAllDocs();
  // 筛选包含技术标签的文档
  const docs = allDocs.filter((doc) => doc.tags.some((tag) => TECH_TAGS.includes(tag)));
  return { docs };
}

export default function TechIndex({ loaderData }: Route.ComponentProps) {
  const { docs } = loaderData;

  // 统计各标签出现次数
  const tagCounts = new Map<string, number>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      if (TECH_TAGS.includes(tag)) {
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
        title="Technical"
        description={`Linux、网络、运维等技术文档，共 ${docs.length} 篇`}
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
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无技术相关文档</p>
      )}
    </div>
  );
}
