import type { Route } from './+types/docs.$slug';
import { getDocBySlug } from '~/lib/docs';
import { TOCProvider, MobileTOCDrawer, DesktopTOC } from '~/components/toc';
import { MermaidRenderer } from '~/components/mermaid-renderer';
import { TagBadge } from '~/components/tag-badge';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  if (!doc) {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `ρV - ${data.title}` }, { name: 'description', content: data.description }];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  return (
    <TOCProvider items={loaderData.toc}>
      {/* Mobile TOC Drawer - button + full screen slide-in */}
      <MobileTOCDrawer />

      <div className="px-4 sm:px-6 lg:px-8 py-12">
        {/* Mermaid renderer for mermaid code blocks */}
        <MermaidRenderer />

        <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-8 lg:max-w-7xl lg:mx-auto">
          {/* Main content */}
          <div className="min-w-0">
            {/* Header - 使用层次感样式 */}
            <header className="doc-header-card">
              <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{loaderData.date}</time>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                {loaderData.title}
              </h1>
              {/* Tags */}
              {loaderData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {loaderData.tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </div>
              )}
            </header>

            {/* Content */}
            <article className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: loaderData.content }} />
            </article>
          </div>

          {/* Desktop TOC sidebar */}
          <DesktopTOC />
        </div>
      </div>
    </TOCProvider>
  );
}
