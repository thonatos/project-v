import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Route } from './+types/_index';
import { ArticleCard } from '~/components/article-card';
import { PageShell } from '~/components/page-shell';
import { getBlogCategoryLabel } from '~/lib/content';
import { getDocsByType, getDocCategories } from '~/lib/docs';
import { featuredProject } from '~/lib/projects';
import { pageTitle } from '~/lib/seo';

const BLOG_PREVIEW_COUNT = 4;

export function meta() {
  return [
    { title: pageTitle('undefined project.') },
    { name: 'description', content: '一个用于沉淀知识、分享思考与呈现项目的公开站点。' },
  ];
}

export async function loader() {
  const [blogDocs, categories] = await Promise.all([getDocsByType('blog'), getDocCategories()]);
  return { blogDocs: blogDocs.slice(0, BLOG_PREVIEW_COUNT), categories };
}

function SectionHeading({ kind, title, to }: { kind: string; title: string; to: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-kicker">{kind}</p>
        <h2>{title}</h2>
      </div>
      <Link to={to} className="text-link">
        查看全部 <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell width="full">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1 translate="no">undefined project.</h1>
          <p>一个用于沉淀知识、分享思考与呈现项目的公开站点。</p>
        </div>
        <nav className="home-index" aria-label="内容分区">
          <Link to="/docs">
            <span>01</span>
            <strong>Docs</strong>
            <small>用于整理和维护可持续查阅的文档。</small>
          </Link>
          <Link to="/blog">
            <span>02</span>
            <strong>Blog</strong>
            <small>用于发布文章与记录观点。</small>
          </Link>
          <Link to="/projects">
            <span>03</span>
            <strong>Projects</strong>
            <small>用于介绍项目的背景、设计与进展。</small>
          </Link>
        </nav>
      </section>

      <div className="home-content">
        <section className="featured-project">
          <div className="featured-project-copy">
            <p className="section-kicker">Featured project · {featuredProject.status}</p>
            <h2>{featuredProject.name}</h2>
            <p className="featured-tagline">{featuredProject.tagline}</p>
            <p>{featuredProject.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={featuredProject.href} className="button-primary">
                了解 Vela
              </Link>
              <a href="https://github.com/thonatos/project-v/tree/main/packages/apps/vela" className="button-secondary">
                查看源码
              </a>
            </div>
          </div>
          <div className="featured-route" aria-label="Vela 让自己的其他 Mac 或 iPhone 访问共享 Mac 上的本地服务">
            <div>
              <span>共享端</span>
              <strong>Mac 本地服务</strong>
            </div>
            <div className="featured-route-line">
              <i />
              <span>Vela 私人连接</span>
            </div>
            <div>
              <span>访问端</span>
              <strong>Mac 或 iPhone</strong>
            </div>
          </div>
        </section>

        <section className="home-section">
          <SectionHeading kind="Latest writing" title="Blog" to="/blog" />
          <div className="content-list">
            {loaderData.blogDocs.map((doc) => (
              <ArticleCard
                key={doc.slug}
                href={doc.href}
                title={doc.title}
                date={doc.date}
                description={doc.description}
                eyebrow={getBlogCategoryLabel(doc.category)}
                variant="compact"
              />
            ))}
          </div>
        </section>

        <section className="home-section">
          <SectionHeading kind="Reference" title="Docs" to="/docs" />
          <div className="docs-category-grid">
            {loaderData.categories.map((group) => (
              <Link
                key={group.category}
                to={`/docs#${encodeURIComponent(group.category)}`}
                className="docs-category-link"
              >
                <span>{String(group.docs.length).padStart(2, '0')}</span>
                <strong>{group.category}</strong>
                <small>
                  {group.docs
                    .map((doc) => doc.title)
                    .slice(0, 2)
                    .join(' · ')}
                </small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
