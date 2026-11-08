import type { Route } from './+types/tags.$tag';
import { LegacyRoute } from '~/components/legacy-route';
import { pageTitle } from '~/lib/seo';

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: pageTitle(`#${params.tag}`, '页面已迁移') },
    { name: 'description', content: '标签导航已由 Blog 栏目取代' },
  ];
}

export default function LegacyTag() {
  return (
    <LegacyRoute
      destination="/blog"
      title="这个标签页已迁移"
      description="请在 Blog 中按“技术与工程”或“股票与市场”浏览文章。"
    />
  );
}
