import { PageShell } from './page-shell';

interface BasicLayoutProps {
  children: React.ReactNode;
}

/** 兼容封装：等价于 contained 宽度的 PageShell。 */
export function BasicLayout({ children }: BasicLayoutProps) {
  return <PageShell width="contained">{children}</PageShell>;
}
