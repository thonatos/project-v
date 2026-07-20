import { useEffect, useState } from 'react';

/**
 * 检测运行环境是否适合渲染 WebGL 增强效果。
 * 返回 null 表示尚未判定（SSR/首帧），true/false 为客户端判定结果。
 * 综合考虑：是否客户端、WebGL 是否可用、是否偏好减少动效。
 */
export function useWebGLCapable(): boolean | null {
  const [capable, setCapable] = useState<boolean | null>(null);

  useEffect(() => {
    // 尊重减少动效偏好
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCapable(false);
      return;
    }

    // 检测 WebGL 支持
    let supported = false;
    try {
      const canvas = document.createElement('canvas');
      supported = Boolean(
        window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
      );
    } catch {
      supported = false;
    }
    setCapable(supported);
  }, []);

  return capable;
}

/** 是否已在客户端挂载（用于 client-only gate）。 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}
