import { LegacyRoute } from '~/components/legacy-route';
import { pageTitle } from '~/lib/seo';

export function meta() {
  return [{ title: pageTitle('页面已迁移') }, { name: 'description', content: '标签导航已由 Blog 栏目取代' }];
}

export default function LegacyTagsIndex() {
  return (
    <LegacyRoute
      destination="/blog"
      title="标签导航已由 Blog 栏目取代"
      description="技术与工程、股票与市场现在是稳定的文章入口。"
    />
  );
}
