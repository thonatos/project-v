import { Suspense, lazy, useEffect, useRef } from 'react';
import type { GraphData } from '~/lib/docs';
import { useWebGLCapable } from '~/lib/use-webgl';

const KnowledgeGraph3D = lazy(() => import('./knowledge-graph-3d'));

interface HeroGraphProps {
  data: GraphData;
}

/**
 * 首页知识图谱背景层：
 * - 固定于视口背后，作为 hero 的增强背景
 * - client-only + WebGL 能力检测，不支持时不渲染（首页静态 DOM 仍完整可用）
 * - 追踪整页滚动进度传入 3D 供相机穿行
 */
export function HeroGraph({ data }: HeroGraphProps) {
  const capable = useWebGLCapable();
  const scrollProgress = useRef(0);

  useEffect(() => {
    if (capable !== true) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress.current = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [capable]);

  if (capable !== true) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-70">
      <Suspense fallback={null}>
        <KnowledgeGraph3D data={data} scrollProgress={scrollProgress} />
      </Suspense>
    </div>
  );
}
