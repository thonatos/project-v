import { Link } from 'react-router';

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm bg-[var(--color-bg)]/80 border-b border-[var(--color-border)] px-4 sm:px-6 lg:px-8">
      <nav className="h-14 flex items-center lg:max-w-7xl lg:mx-auto">
        {/* Logo */}
        <Link
          to="/"
          className="text-sm font-semibold tracking-tight hover:text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span translate="no">ρV</span>
        </Link>
      </nav>
    </header>
  );
}
