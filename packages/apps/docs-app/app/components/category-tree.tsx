import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { FolderTree, X } from 'lucide-react';
import type { DocCategory } from '~/lib/docs';

interface CategoryTreeProps {
  categories: DocCategory[];
  activeSlug?: string;
}

function TreeNav({ categories, activeSlug, onNavigate }: CategoryTreeProps & { onNavigate?: () => void }) {
  return (
    <ul className="space-y-5">
      {categories.map((group) => (
        <li key={group.category}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {group.category}
          </h4>
          <ul className="space-y-1 border-l border-[var(--color-border-subtle)] pl-3">
            {group.docs.map((doc) => {
              const isActive = doc.slug === activeSlug;
              return (
                <li key={doc.slug}>
                  <Link
                    to={`/docs/${doc.slug}`}
                    onClick={onNavigate}
                    className={`block py-1 text-sm transition-colors hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                      isActive ? 'font-medium text-[var(--color-primary-hover)]' : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {doc.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// Desktop category tree - sticky sidebar (lg and up)
export function DesktopCategoryTree({ categories, activeSlug }: CategoryTreeProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <nav className="hidden lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto py-4 pr-4 scrollbar-none">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Docs</h3>
      <TreeNav categories={categories} activeSlug={activeSlug} />
    </nav>
  );
}

// Mobile category tree - drawer slide-in from left (mirrors TOC drawer pattern)
export function MobileCategoryTree({ categories, activeSlug }: CategoryTreeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] lg:hidden"
        aria-label="打开分类目录"
        aria-expanded={isOpen}
      >
        <FolderTree className="h-5 w-5" />
      </button>

      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-full bg-[var(--color-bg)] shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--color-border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--color-primary)]">Docs</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
              aria-label="关闭分类目录"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            <TreeNav categories={categories} activeSlug={activeSlug} />
          </nav>
        </div>
      </div>
    </>
  );
}
