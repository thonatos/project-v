import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  depth: number;
  children: TocItem[];
}

interface TOCProps {
  items: TocItem[];
}

export function TOC({ items }: TOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Setup IntersectionObserver for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80px 0px' },
    );

    const headings = document.querySelectorAll('h2, h3');
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, []);

  if (items.length === 0) {
    return null;
  }

  const renderItem = (item: TocItem, level: number = 0): React.ReactNode => (
    <li key={item.id}>
      <a
        href={`#${item.id}`}
        className={`block text-sm py-1 transition-colors hover:text-[var(--color-primary)] ${
          level > 0 ? 'pl-4' : ''
        } ${activeId === item.id ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}
      >
        {item.text}
      </a>
      {item.children.length > 0 && (
        <ul className="space-y-1">{item.children.map((child) => renderItem(child, level + 1))}</ul>
      )}
    </li>
  );

  return (
    <>
      {/* Desktop TOC - sticky sidebar */}
      <nav className="hidden lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto py-4">
        <h4 className="text-sm font-semibold mb-3 text-[var(--color-text)]">目录</h4>
        <ul className="space-y-1">{items.map((item) => renderItem(item))}</ul>
      </nav>

      {/* Mobile TOC - collapsible */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          aria-label="显示目录"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>

        {isExpanded && (
          <nav className="absolute bottom-12 right-0 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 shadow-lg max-w-xs max-h-64 overflow-y-auto">
            <h4 className="text-sm font-semibold mb-3 text-[var(--color-text)]">目录</h4>
            <ul className="space-y-1">{items.map((item) => renderItem(item))}</ul>
          </nav>
        )}
      </div>
    </>
  );
}
