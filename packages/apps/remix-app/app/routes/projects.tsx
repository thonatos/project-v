import React, { Suspense } from 'react';
import { Link, Await, useAsyncValue } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { RepositoryFilter } from '~/components/biz/repository-filter';
import { RepositoryList } from '~/components/biz/repository-list';
import { RepositorySkeleton } from '~/components/biz/repository-skeleton';

export const handle = {
  breadcrumb: () => <Link to="/projects">Projects</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Projects' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const ProjectsPage: React.FC<{}> = () => {
  const value = useAsyncValue();
  return (
    <div className="grid grid-cols-1">
      <h2 className="text-sm font-bold mb-6">Starred github repositories.</h2>
      <RepositoryFilter />
      <Suspense fallback={<RepositorySkeleton />}>
        <Await resolve={value}>
          <RepositoryList />
        </Await>
      </Suspense>
    </div>
  );
};

export default ProjectsPage;
