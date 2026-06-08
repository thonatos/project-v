import { Link } from 'react-router';
import { Github } from 'lucide-react';

export function AppShellFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} i18n-studio</span>
        <nav className="flex items-center gap-5" aria-label="footer 导航">
          <Link to="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a href="/openapi.json" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            API
          </a>
          <a
            href="https://github.com/thonatos/project-v"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub"
            className="inline-flex items-center transition-colors hover:text-foreground"
          >
            <Github className="size-4" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
