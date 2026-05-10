interface ContentPanelProps {
  children: React.ReactNode;
  variant?: 'default' | 'emphasis';
  className?: string;
}

const PANEL_STYLES = {
  default: 'rounded-lg border border-[var(--color-border-subtle)] bg-white/50 p-6',
  emphasis:
    'rounded-lg border border-[var(--color-border)] bg-transparent p-5 shadow-[inset_0_0_0_1px_rgba(31,41,55,0.06)]',
};

export function ContentPanel({ children, variant = 'default', className }: ContentPanelProps) {
  const classNames = [PANEL_STYLES[variant], className].filter(Boolean).join(' ');

  return <section className={classNames}>{children}</section>;
}
