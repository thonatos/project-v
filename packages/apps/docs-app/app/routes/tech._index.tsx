import type { Route } from './+types/tech._index';
import { Link } from 'react-router';
import { getAllDocs } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';

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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            ← 返回首页
          </Link>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">Technical</h1>
        <p className="text-lg text-[var(--color-text-muted)] mb-6">Linux、网络、运维等技术文档，共 {docs.length} 篇</p>

        {/* 标签云 */}
        <div className="flex flex-wrap gap-2">
          {Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => (
              <Link
                key={tag}
                to={`/tags/${tag}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-md bg-[var(--color-bg-subtle)] text-[var(--color-primary-deep)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                {tag}
                <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
              </Link>
            ))}
        </div>
      </header>

      {docs.length > 0 ? (
        <div className="space-y-8">
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
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无技术相关文档</p>
      )}
    </div>
  );
}
