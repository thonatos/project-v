import type { Config } from '@react-router/dev/config';
import { getAllDocs, getLegacyTags } from './app/lib/docs';

export default {
  ssr: false,
  async prerender() {
    const docs = await getAllDocs();
    const tags = await getLegacyTags();
    return [
      '/',
      '/blog',
      '/docs',
      '/projects',
      '/projects/vela',
      '/tags',
      ...docs.filter((doc) => doc.type === 'docs').map((doc) => doc.href),
      ...docs.filter((doc) => doc.type === 'blog').flatMap((doc) => [doc.href, `/docs/${doc.slug}`]),
      ...tags.map((tag) => `/tags/${tag}`),
    ];
  },
} satisfies Config;
