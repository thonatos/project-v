import { Link } from 'react-router';
import { Logo } from '~/components/custom/logo';
import { Tiptap } from '~/components/tiptap/editor';
import { ProjectList } from '~/components/biz/project-list';
import { StrategyCard } from '~/components/biz/strategy-card';
import type { Route } from './+types/support';

export const handle = {
  breadcrumb: () => <Link to="/support">Support</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Support' }, { name: 'ρV', content: 'undefined project - ρV' }];
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
