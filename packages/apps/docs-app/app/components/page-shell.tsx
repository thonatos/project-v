import { Footer } from './footer';
import { Header } from './header';

export type PageWidth = 'full' | 'contained' | 'reading';

interface PageShellProps {
  children: React.ReactNode;
  /** 布局宽度：full 全宽舞台 / contained 常规 / reading 阅读 */
  width?: PageWidth;
  /** full 模式下 Header 叠加为透明浮层于内容之上 */
  overlayHeader?: boolean;
  /** 舞台模式：锁定为单屏视口、禁止页面滚动（用于纯 3D 展示页；仍保留 footer） */
  stage?: boolean;
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
 * - full：100vw 无边距，承载 WebGL 舞台；内层内容自行包裹可读容器
 * - contained：max-w-7xl 居中，列表/常规页
 * - reading：max-w-3xl 居中，正文阅读
 * - stage：锁定单屏、禁滚动（纯展示舞台，保留 footer）
 */
export function PageShell({
  children,
  width = 'contained',
  overlayHeader = false,
  stage = false,
  mainClassName,
}: PageShellProps) {
  return (
    <div className={stage ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen flex flex-col'}>
      <Header overlay={overlayHeader} />
      <main
        id="main-content"
        className={`flex flex-1 flex-col ${overlayHeader ? '-mt-14' : ''} ${stage ? 'min-h-0' : ''} ${mainClassName ?? ''}`}
      >
        <div className={`${WIDTH_CONTAINER[width]} ${stage ? 'flex-1 min-h-0' : ''}`}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
