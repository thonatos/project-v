import { BlogShell } from './blog-shell';
import type { TocItem } from './toc';

interface ArticleLayoutProps {
  toc: TocItem[];
  children: React.ReactNode;
  layout?: 'reading' | 'wide';
}

export function ArticleLayout({ toc, children, layout = 'reading' }: ArticleLayoutProps) {
  return (
    <BlogShell toc={toc}>
      <div className={layout === 'wide' ? 'min-w-0' : 'min-w-0 w-full max-w-3xl'}>{children}</div>
    </BlogShell>
  );
}
