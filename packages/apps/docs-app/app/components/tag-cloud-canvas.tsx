import { Suspense, lazy } from 'react';
import type { TagInfo } from '~/lib/docs';
import { TagCloud } from './tag-cloud';
import { useWebGLCapable } from '~/lib/use-webgl';

const TagCloud3D = lazy(() => import('./tag-cloud-3d'));

interface TagCloudCanvasProps {
  tags: TagInfo[];
}

/**
 * 标签云容器：
 * - SSR / 无 WebGL / reduced-motion → 渲染 2D 语义化 TagCloud（真链接，SEO/a11y 友好）
 * - 支持 WebGL 的客户端 → 懒加载 3D 标签球覆盖展示
 * three/R3F 仅在 3D 分支被动态 import，不进首屏 bundle。
 */
export function TagCloudCanvas({ tags }: TagCloudCanvasProps) {
  const capable = useWebGLCapable();

  if (capable !== true) {
    // 尚未判定或不支持：始终提供 2D 可用降级（居中、可滚动）
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto px-4 py-24">
        <TagCloud tags={tags} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* 语义化降级链接：视觉隐藏但保留于 DOM，供爬虫/读屏 */}
      <ul className="sr-only">
        {tags.map((tag) => (
          <li key={tag.name}>
            <a href={`/tags/${tag.name}`}>
              {tag.name}（{tag.count}）
            </a>
          </li>
        ))}
      </ul>
      <div aria-hidden className="h-full w-full">
        <Suspense fallback={null}>
          <TagCloud3D tags={tags} />
        </Suspense>
      </div>
    </div>
  );
}
