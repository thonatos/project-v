import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, route } from '@react-router/dev/routes';

// Use flatRoutes for TSX routes and manually add MDX routes
export default [
  // Layout route wraps all routes
  layout('routes/_layout.tsx', [
    // Index route
    index('routes/_index.tsx'),
    // MDX routes for docs
    route('docs/getting-started', 'routes/docs/getting-started.mdx'),
    // MDX routes for manuscripts
    route('manuscripts/my-thoughts', 'routes/manuscripts/my-thoughts.mdx'),
  ]),
] satisfies RouteConfig;
