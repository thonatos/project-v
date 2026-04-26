import { useState, useEffect, useRef } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export function TOC() {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Extract headings from the document
    const headings = document.querySelectorAll('h2, h3');
    const tocItems: TOCItem[] = Array.from(headings).map((h) => ({
      id: h.id,
      text: h.textContent || '',
      level: parseInt(h.tagName.charAt(1), 10),
    }));
    setItems(tocItems);

    // Setup IntersectionObserver
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80px 0px' }
    );

    headings.forEach((h) => {
      if (observerRef.current) {
        observerRef.current.observe(h);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="hidden lg:block fixed right-8 top-20 w-48">
      <h4 className="text-sm font-semibold mb-3 text-[var(--color-text-muted)]">目录</h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`text-sm hover:text-[var(--color-primary)] transition-colors ${
                item.level === 3 ? 'pl-3' : ''
              } ${
                activeId === item.id
                  ? 'text-[var(--color-primary)] font-medium'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}