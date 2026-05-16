import type { Config } from '@react-router/dev/config';
import { getDocSlugs, getAllTags } from './app/lib/docs';

export default {
  ssr: false,
  async prerender() {
    const slugs = await getDocSlugs();
    const tags = await getAllTags();
    return ['/', '/tags', ...slugs.map((slug) => `/docs/${slug}`), ...tags.map((tag) => `/tags/${tag.name}`)];
  },
} satisfies Config;
