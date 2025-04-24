import loadable from '@loadable/component';
import { Link } from 'react-router';
import { RepositoryFilter } from '~/components/biz/repository-filter';
import { getMeta } from '~/lib/seo-util';

import type { Route } from './+types/github.stars';

const RepositoryList = loadable(() => import('~/components/biz/repository-list'));

export const handle = {
  breadcrumb: () => <Link to="/github/stars">Github Stars</Link>,
};

export const meta = ({ location }: Route.MetaArgs) => {
  const title = 'Github Stars';
  const pathname = location.pathname;

  const props = getMeta({
    pathname,
    title,
    description: 'Github Stars',
  });

  return [...props, { title }];
};

export default function ({}: Route.ComponentProps) {
  return (
    <div className="flex flex-col gap-4">
      <RepositoryFilter />
      <RepositoryList />
    </div>
  );
}
