import { Footer } from './footer';
import { Header } from './header';
import { MermaidRenderer } from './mermaid-renderer';
import { DesktopCategoryTree, MobileCategoryTree } from './category-tree';
import { DesktopTOC, TOCProvider, type TocItem } from './toc';
import type { DocCategory } from '~/lib/docs';

interface DocLayoutProps {
  toc: TocItem[];
  children: React.ReactNode;
  categories?: DocCategory[];
  activeSlug?: string;
  /** 正文宽度：reading 定宽阅读（默认）/ wide 宽版 */
  layout?: 'reading' | 'wide';
}

export function DocLayout({ toc, children, categories, activeSlug, layout = 'reading' }: DocLayoutProps) {
  const hasTree = Boolean(categories && categories.length > 0);

  // docs: category tree + content + TOC (3-col); blog: content + TOC (2-col)
  const gridClass = hasTree
    ? 'w-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)_200px] lg:gap-8 lg:max-w-7xl lg:mx-auto'
    : 'w-full lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-8 lg:max-w-7xl lg:mx-auto';

  // reading 模式下为正文列限制最佳阅读行宽
  const contentClass = layout === 'wide' ? 'min-w-0' : 'min-w-0 mx-auto w-full max-w-3xl';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <TOCProvider items={toc}>
          {hasTree && <MobileCategoryTree categories={categories!} activeSlug={activeSlug} />}
          <div className="grow px-4 sm:px-6 lg:px-8 py-12">
            <MermaidRenderer />

            <div className={gridClass}>
              {hasTree && <DesktopCategoryTree categories={categories!} activeSlug={activeSlug} />}
              <div className={contentClass}>{children}</div>
              <DesktopTOC />
            </div>
          </div>
        </TOCProvider>
      </main>
      <Footer />
    </div>
  );
}
