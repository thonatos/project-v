import { Link } from 'react-router';
import { Github } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-sm bg-white/80 border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <nav className="h-14 flex items-center justify-between lg:max-w-7xl lg:mx-auto">
        {/* 左侧 Logo */}
        <Link
          to="/"
          className="text-sm font-medium tracking-tight text-[var(--color-text)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span translate="no" className="text-[var(--color-primary)]">
            ρV
          </span>
          <span className="pl-2" translate="no">
            undefined project.
          </span>
        </Link>

        {/* 右侧导航链接 */}
        <div className="flex items-center">
          {/* TOC button slot - for mobile TOC drawer */}
          <div id="header-toc-slot" className="lg:hidden flex items-center mr-2" />

          {/* 导航链接 - 桌面端显示 */}
          <div className="hidden lg:flex items-center gap-1">
            <Link
              to="/tags"
              className="px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              All Tags
            </Link>

            <Link
              to="/tech"
              className="px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Technical
            </Link>

            <Link
              to="/trading"
              className="px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Trading
            </Link>

            {/* 竖线分割 - 导航链接与 GitHub */}
            <div className="h-4 w-px bg-gray-200 mx-2" />

            <a
              href="https://github.com/thonatos/project-v"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="访问 GitHub 仓库"
              className="px-3 py-2 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>

          {/* 移动端：分割线 + GitHub 图标 */}
          <div className="lg:hidden flex items-center">
            {/* 竖线分割 - TOC 与 GitHub */}
            <div id="mobile-divider" className="h-4 w-px bg-gray-200 mr-3 hidden" />
            <a
              href="https://github.com/thonatos/project-v"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="访问 GitHub 仓库"
              className="flex items-center justify-center px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
