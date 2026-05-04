import { useEffect, useState } from 'react';

export function Footer() {
  const [year, setYear] = useState<number>();

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="border-t border-[var(--color-border-subtle)] mt-16 py-6 px-4 sm:px-6 lg:px-8 bg-white/60 backdrop-blur-sm">
      <div className="lg:max-w-7xl lg:mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text)]">
            <span translate="no">ρV</span> &copy; {year}
          </p>

          <p className="text-sm text-[var(--color-text)]">
            Built with{' '}
            <a
              href="https://reactrouter.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
            >
              ❤ React Router
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
