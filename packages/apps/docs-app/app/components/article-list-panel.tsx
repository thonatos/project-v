import { ContentPanel } from './content-panel';

interface ArticleListPanelProps {
  title?: string;
  count: number;
  children: React.ReactNode;
}

export function ArticleListPanel({ title = '文章列表', count, children }: ArticleListPanelProps) {
  return (
    <ContentPanel>
      <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
        <span className="text-sm text-[var(--color-text-muted)]">{count} 篇</span>
      </div>
      <div className="space-y-8">{children}</div>
    </ContentPanel>
  );
}
