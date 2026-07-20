import { Link } from 'react-router';
import type { Route } from './+types/_index';
import { getDocsByType, getDocCategories, getGraphData } from '~/lib/docs';
import { ArticleCard } from '~/components/article-card';
import { PageShell } from '~/components/page-shell';
import { SummaryLinkCard } from '~/components/summary-link-card';
import { HeroGraph } from '~/components/hero-graph';
import { RevealSection } from '~/components/reveal-section';
import { getCategoryColor } from '~/lib/tag-colors';

const BLOG_PREVIEW_COUNT = 5;

export function meta() {
  return [{ title: 'ρV' }, { name: 'description', content: 'undefined project' }];
}

export async function loader() {
  const [blogDocs, categories, graph] = await Promise.all([getDocsByType('blog'), getDocCategories(), getGraphData()]);
  return { blogDocs: blogDocs.slice(0, BLOG_PREVIEW_COUNT), categories, graph };
}

function SectionHeader({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between border-b border-[var(--color-border-subtle)] pb-2">
      <h2 className="text-lg font-bold tracking-tight text-[var(--color-text)]">{title}</h2>
      <Link
        to={to}
        className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { blogDocs, categories, graph } = loaderData;

  return (
    <PageShell width="full" overlayHeader>
      {/* 全宽知识图谱背景（WebGL，客户端增强，可降级为无） */}
      <HeroGraph data={graph} />

      {/* Hero 舞台 */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            <span translate="no" className="text-gradient-brand">
              ρV
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--color-text)] sm:text-xl">undefined project</p>
          <p className="mt-3 max-w-2xl text-base text-[var(--color-text-muted)]">
            投资分析与技术笔记，记录市场观察与折腾过程。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/blog"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105"
              style={{ background: 'var(--gradient-brand)' }}
            >
              阅读 Blog
            </Link>
            <Link to="/tags" className="glass-card px-5 py-2.5 text-sm font-medium text-[var(--color-text)]">
              探索标签云
            </Link>
          </div>
          <p className="mt-16 animate-pulse text-xs text-[var(--color-text-muted)]">向下滚动 ↓</p>
        </div>
      </section>

      {/* 内容分区 */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-20">
          <RevealSection>
            <SectionHeader title="Blog" to="/blog" linkLabel="查看全部" />
            {blogDocs.length > 0 ? (
              <div className="glass-card flex flex-col px-5">
                {blogDocs.map((doc) => (
                  <ArticleCard
                    key={doc.slug}
                    variant="compact"
                    href={`/docs/${doc.slug}`}
                    title={doc.title}
                    date={doc.date}
                    description={doc.description}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[var(--color-text-muted)]">暂无文章</p>
            )}
          </RevealSection>

          <RevealSection>
            <SectionHeader title="Docs" to="/docs" linkLabel="查看全部" />
            {categories.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {categories.map((group) => {
                  const color = getCategoryColor(group.category);
                  return (
                    <SummaryLinkCard
                      key={group.category}
                      to={`/docs#${encodeURIComponent(group.category)}`}
                      className="relative overflow-hidden"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ backgroundColor: color.accent }}
                      />
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <h3 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary-hover)]">
                          {group.category}
                        </h3>
                        <span className="shrink-0 rounded-full px-2 py-1 text-xs text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                          {group.docs.length} 篇
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1 pl-2">
                        {group.docs.slice(0, 3).map((doc) => (
                          <li key={doc.slug} className="line-clamp-1 text-sm text-[var(--color-text-muted)]">
                            {doc.title}
                          </li>
                        ))}
                      </ul>
                    </SummaryLinkCard>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-[var(--color-text-muted)]">暂无文档</p>
            )}
          </RevealSection>
        </div>
      </div>
    </PageShell>
  );
}
