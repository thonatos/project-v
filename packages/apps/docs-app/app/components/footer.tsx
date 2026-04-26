export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-16 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-[var(--color-text-muted)]">Docs App &copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
