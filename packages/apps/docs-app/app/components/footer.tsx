import { useEffect, useState } from 'react';

export function Footer() {
  const [year, setYear] = useState<number>();

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="border-t border-[var(--color-border)] mt-16 py-6 px-4 sm:px-6 lg:px-8">
      <div className="lg:max-w-7xl lg:mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            <span translate="no">ρV</span> &copy; {year}
          </p>

          <p className="text-sm text-[var(--color-text-muted)]">
            Built with ❤️ using{' '}
            <a
              href="https://reactrouter.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] hover:underline"
            >
              React Router
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
