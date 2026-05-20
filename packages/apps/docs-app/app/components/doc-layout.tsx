import { Footer } from './footer';
import { Header } from './header';
import { MermaidRenderer } from './mermaid-renderer';
import { DesktopTOC, TOCProvider, type TocItem } from './toc';

interface DocLayoutProps {
  toc: TocItem[];
  children: React.ReactNode;
}

export function DocLayout({ toc, children }: DocLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <TOCProvider items={toc}>
          <div className="grow px-4 sm:px-6 lg:px-8 py-12">
            <MermaidRenderer />

            <div className="w-full lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-8 lg:max-w-7xl lg:mx-auto">
              <div className="min-w-0">{children}</div>
              <DesktopTOC />
            </div>
          </div>
        </TOCProvider>
      </main>
      <Footer />
    </div>
  );
}
