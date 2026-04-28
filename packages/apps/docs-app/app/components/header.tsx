import { Link } from 'react-router';
import { Github } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm bg-[var(--color-bg)]/80 border-b border-[var(--color-border)] px-4 sm:px-6 lg:px-8">
      <nav className="h-14 flex items-center justify-between lg:max-w-7xl lg:mx-auto">
        {/* Logo */}
        <Link
          to="/"
          className="text-sm font-medium tracking-tight text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span translate="no">ρV</span>
          <span className="pl-2" translate="no">
            undefined project.
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/thonatos/project-v"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="访问 GitHub 仓库"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </nav>
    </header>
  );
}
