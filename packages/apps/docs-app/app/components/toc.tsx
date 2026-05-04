import { useEffect, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

interface TocItem {
  id: string;
  text: string;
  depth: number;
  children: TocItem[];
}

interface TOCContextValue {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  activeId: string;
  items: TocItem[];
}

const TOCContext = createContext<TOCContextValue | null>(null);

export function useTOC() {
  const context = useContext(TOCContext);
  if (!context) {
    throw new Error('useTOC must be used within TOCProvider');
  }
  return context;
}

interface TOCProviderProps {
  items: TocItem[];
  children: React.ReactNode;
}

export function TOCProvider({ items, children }: TOCProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
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

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return <TOCContext.Provider value={{ isOpen, setIsOpen, activeId, items }}>{children}</TOCContext.Provider>;
}

// Mobile TOC Drawer Button - rendered into header slot via Portal
function MobileTOCMenuButtonInner() {
  const { isOpen, setIsOpen, items } = useTOC();

  if (items.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className="flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
      aria-label={isOpen ? '关闭目录' : '打开目录'}
      aria-expanded={isOpen}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    </button>
  );
}

export function MobileTOCMenuButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const slot = document.getElementById('header-toc-slot');
  if (!slot) {
    return null;
  }

  return createPortal(<MobileTOCMenuButtonInner />, slot);
}

// Mobile TOC Drawer - full screen slide-in from right (no backdrop)
export function MobileTOCDrawer() {
  const { isOpen, setIsOpen, activeId, items } = useTOC();

  if (items.length === 0) {
    return null;
  }

  const renderItem = (item: TocItem, level: number = 0): React.ReactNode => (
    <li key={item.id}>
      <a
        href={`#${item.id}`}
        onClick={() => setIsOpen(false)}
        className={`block text-base py-3 px-4 transition-colors hover:bg-[var(--color-bg-subtle)] rounded-lg ${
          level > 0 ? 'pl-8' : ''
        } ${activeId === item.id ? 'text-[var(--color-primary)] font-medium bg-[var(--color-bg-subtle)]' : 'text-[var(--color-text)]'}`}
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
      {/* Menu button in header nav area */}
      <MobileTOCMenuButton />

      {/* Drawer panel - full width, no backdrop */}
      <div
        className={`lg:hidden fixed inset-y-0 right-0 z-50 w-full bg-[var(--color-bg)] shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Drawer header - match Header height (h-14 = 56px) */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--color-border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--color-primary)]">目录</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
              aria-label="关闭目录"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer content - scrollable */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">{items.map((item) => renderItem(item))}</ul>
          </nav>
        </div>
      </div>
    </>
  );
}

// Desktop TOC - sticky sidebar
interface DesktopTOCProps {
  className?: string;
}

export function DesktopTOC({ className }: DesktopTOCProps) {
  const { activeId, items } = useTOC();

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
    <nav className={`hidden lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto py-4 ${className}`}>
      <h4 className="text-sm font-semibold mb-3 text-[var(--color-primary)]">目录</h4>
      <ul className="space-y-1">{items.map((item) => renderItem(item))}</ul>
    </nav>
  );
}
