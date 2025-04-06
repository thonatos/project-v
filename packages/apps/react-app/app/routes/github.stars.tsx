import React, { Suspense } from 'react';
import { Link, Await, useAsyncValue } from 'react-router';
import type { Route } from './+types/github.stars';

import { RepositoryFilter } from '~/components/biz/repository-filter';
import { RepositoryList } from '~/components/biz/repository-list';
import { RepositorySkeleton } from '~/components/biz/repository-skeleton';

export const handle = {
  breadcrumb: () => <Link to="/github/stars">Github Stars</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Github Stars' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const GithubStarsPage: React.FC<{}> = () => {
  const value = useAsyncValue();
  return (
    <div className="grid grid-cols-1">
      <RepositoryFilter />
      <Suspense fallback={<RepositorySkeleton />}>
        <Await resolve={value}>
          <RepositoryList />
        </Await>
      </Suspense>
    </div>
  );
};

export default GithubStarsPage;
