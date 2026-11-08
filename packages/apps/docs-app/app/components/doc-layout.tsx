import { DocsShell } from './docs-shell';
import type { TocItem } from './toc';
import type { DocCategory } from '~/lib/docs';

interface DocLayoutProps {
  toc: TocItem[];
  children: React.ReactNode;
  categories: DocCategory[];
  activeSlug?: string;
  layout?: 'reading' | 'wide';
}

export function DocLayout({ toc, children, categories, activeSlug, layout = 'reading' }: DocLayoutProps) {
  return (
    <DocsShell toc={toc} categories={categories} activeSlug={activeSlug}>
      <div className={layout === 'wide' ? 'min-w-0' : 'min-w-0 w-full'}>{children}</div>
    </DocsShell>
  );
}
