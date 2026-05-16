import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, route } from '@react-router/dev/routes';

export default [
  layout('routes/_layout.tsx', [
    index('routes/_index.tsx'),
    route('docs/:slug', 'routes/docs.$slug.tsx'),
    route('tags', 'routes/tags._index.tsx'),
    route('tags/:tag', 'routes/tags.$tag.tsx'),
  ]),
] satisfies RouteConfig;
