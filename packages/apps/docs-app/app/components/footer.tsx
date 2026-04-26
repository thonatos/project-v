export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-16 py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">ρV &copy; {new Date().getFullYear()}</p>
          <a
            href="https://github.com/thonatos/project-v"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
