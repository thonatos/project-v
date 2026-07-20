import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Github } from 'lucide-react';

interface HeaderProps {
  /** 透明玻璃浮层模式：顶部透明叠加于内容，滚动后渐变实心 */
  overlay?: boolean;
}

export function Header({ overlay = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) {
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  // overlay 未滚动：全透明浮层；overlay 已滚动 或 非 overlay：玻璃实心
  const solid = !overlay || scrolled;
  const barClass = solid
    ? 'backdrop-blur-md bg-[var(--color-bg)]/80 border-b border-[var(--color-border-subtle)]'
    : 'bg-transparent border-b border-transparent';

  const linkClass =
    'px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';
  const mobileLinkClass =
    'px-2 py-1 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

  return (
    <header className={`sticky top-0 z-40 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${barClass}`}>
      <nav className="h-14 w-full flex items-center justify-between lg:max-w-7xl lg:mx-auto">
        <Link
          to="/"
          className="text-sm font-medium tracking-tight text-[var(--color-text)] hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span translate="no" className="text-gradient-brand font-bold">
            ρV
          </span>
          <span className="pl-2 text-[var(--color-text-muted)]" translate="no">
            undefined project.
          </span>
        </Link>

        <div className="flex items-center">
          <div className="hidden lg:flex items-center gap-1">
            <Link to="/blog" className={linkClass}>
              Blog
            </Link>
            <Link to="/docs" className={linkClass}>
              Docs
            </Link>
            <Link to="/tags" className={linkClass}>
              All Tags
            </Link>
            <div className="h-4 w-px bg-[var(--color-border)] mx-2" />
            <a
              href="https://github.com/thonatos/project-v"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="访问 GitHub 仓库"
              className="px-3 py-2 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>

          <div className="lg:hidden flex items-center gap-1">
            <Link to="/blog" className={mobileLinkClass}>
              Blog
            </Link>
            <Link to="/docs" className={mobileLinkClass}>
              Docs
            </Link>
            <a
              href="https://github.com/thonatos/project-v"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="访问 GitHub 仓库"
              className="flex items-center justify-center px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
