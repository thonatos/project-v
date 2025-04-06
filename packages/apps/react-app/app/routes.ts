import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('/finances', 'routes/finances.tsx'),
  route('/github/stars', 'routes/github.stars.tsx'),
  route('/support', 'routes/support.tsx'),
] satisfies RouteConfig;
