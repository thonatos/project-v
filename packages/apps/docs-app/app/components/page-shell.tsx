import { Footer } from './footer';
import { Header } from './header';

export type PageWidth = 'full' | 'contained' | 'reading';

interface PageShellProps {
  children: React.ReactNode;
  /** 布局宽度：full 全宽舞台 / contained 常规 / reading 阅读 */
  width?: PageWidth;
  /** 页面级主题或背景作用于 Header、正文与 Footer 的共同外壳。 */
  shellClassName?: string;
  /** 自定义主区 className（如 full 模式下去除默认内边距） */
  mainClassName?: string;
}

const WIDTH_CONTAINER: Record<PageWidth, string> = {
  full: 'w-full',
  contained: 'w-full grow px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto',
  reading: 'w-full grow px-4 sm:px-6 lg:px-8 py-12 lg:max-w-3xl lg:mx-auto',
};

/**
 * PageShell - 统一页面外壳，按职能选择三级宽度。
 * - full：100vw 无边距；内层内容自行包裹可读容器
 * - contained：max-w-7xl 居中，列表/常规页
 * - reading：max-w-3xl 居中，正文阅读
 */
export function PageShell({ children, width = 'contained', shellClassName, mainClassName }: PageShellProps) {
  return (
    <div className={`min-h-screen flex flex-col ${shellClassName ?? ''}`}>
      <Header />
      <main id="main-content" className={`flex flex-1 flex-col ${mainClassName ?? ''}`}>
        <div className={WIDTH_CONTAINER[width]}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
