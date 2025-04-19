import { Link } from 'react-router';
import { Logo } from '~/components/biz/logo';
import { Tiptap } from '~/components/tiptap/editor';
import { ProjectList } from '~/components/biz/project-list';
import { StrategyCard } from '~/components/biz/strategy-card';
import { getMeta } from '~/lib/seo-util';

import type { Route } from './+types/support';

export const handle = {
  breadcrumb: () => <Link to="/support">Support</Link>,
};

export const meta = ({ location }: Route.MetaArgs) => {
  const title = 'Support';
  const pathname = location.pathname;
  const props = getMeta({
    pathname,
    title,
    description: 'Support and links',
  });

  return [...props, { title }];
};

export default function ({}: Route.ComponentProps) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <div>
        <StrategyCard />
      </div>

      <div>
        <ProjectList />
      </div>

      <div className="space-y-4">
        <Logo title="ρV" description="undefined project" />
        <Tiptap
          content={`
          <blockquote>
            If you need help, please contact us at
            <a href="mailto:thonatos.yang@gmail.com" className="text-blue-500">
              thonatos.yang@gmail.com
            </a>
          </blockquote>
        `}
          editable={false}
        />
      </div>
    </div>
  );
}
