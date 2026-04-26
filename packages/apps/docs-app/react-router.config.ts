import type { Config } from '@react-router/dev/config';
import { getDocSlugs } from './app/lib/docs';

export default {
  ssr: false,
  async prerender() {
    const slugs = await getDocSlugs();
    return ['/', ...slugs.map((slug) => `/docs/${slug}`)];
  },
} satisfies Config;
