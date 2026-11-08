import { Footer } from './footer';
import { Header } from './header';
import { MermaidRenderer } from './mermaid-renderer';
import { DesktopTOC, TOCProvider, type TocItem } from './toc';

interface BlogShellProps {
  children: React.ReactNode;
  toc?: TocItem[];
}

export function BlogShell({ children, toc }: BlogShellProps) {
  const isDetail = toc !== undefined;
  const items = toc ?? [];
  const hasToc = items.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <TOCProvider items={items}>
          <div className={`blog-shell-grid ${hasToc ? 'lg:grid-cols-[minmax(0,1fr)_210px]' : ''}`}>
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
