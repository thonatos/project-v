const copyrightYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="text-[var(--color-text-muted)]">
          ©{' '}
          <time dateTime={String(copyrightYear)} suppressHydrationWarning>
            {copyrightYear}
          </time>
        </p>
        <p translate="no" className="site-footer-brand">
          <span className="font-semibold text-[var(--color-text)]">ρV</span>
          <span>undefined project.</span>
        </p>
      </div>
    </footer>
  );
}
