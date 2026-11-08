import { DesktopCategoryTree, MobileCategoryTree } from './category-tree';
import { Footer } from './footer';
import { Header } from './header';
import { MermaidRenderer } from './mermaid-renderer';
import { DesktopTOC, TOCProvider, type TocItem } from './toc';
import type { DocCategory } from '~/lib/docs';

interface DocsShellProps {
  categories: DocCategory[];
  children: React.ReactNode;
  activeSlug?: string;
  toc?: TocItem[];
}

export function DocsShell({ categories, children, activeSlug, toc }: DocsShellProps) {
  const isDetail = toc !== undefined;
  const items = toc ?? [];
  const hasToc = items.length > 0;
  const columns = hasToc ? 'lg:grid-cols-[220px_minmax(0,1fr)_200px]' : 'lg:grid-cols-[220px_minmax(0,1fr)]';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <TOCProvider items={items}>
          <MobileCategoryTree categories={categories} activeSlug={activeSlug} />
          <div className={`docs-shell-grid ${columns}`}>
            <DesktopCategoryTree categories={categories} activeSlug={activeSlug} />
            <div className="min-w-0">
              {isDetail ? <MermaidRenderer /> : null}
              {children}
            </div>
            {hasToc ? <DesktopTOC /> : null}
          </div>
        </TOCProvider>
      </main>
      <Footer />
    </div>
  );
}
