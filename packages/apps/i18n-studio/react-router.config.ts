import type { Config } from '@react-router/dev/config';

import { getDocSlugs } from './app/lib/docs';

export default {
  ssr: true,
  // 静态预渲染 docs 全部页面 — build 期生成静态 HTML,运行时不进 SSR。
  // docs layout loader 仅调用 getTheme(无 cookie 返回 'system')与 getUser
  // (无 session userId 时短路返回 null,不触达 DB),在无 request cookie 的
  // prerender 上下文中安全降级。
  async prerender() {
    const slugs = await getDocSlugs();
    return ['/docs', ...slugs.filter((s) => s !== 'index').map((s) => `/docs/${s}`)];
  },
} satisfies Config;
