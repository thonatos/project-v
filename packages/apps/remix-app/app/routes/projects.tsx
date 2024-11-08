import React, { Suspense } from 'react';
import { Link, Await, useAsyncValue } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
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
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle>Starred github repositories.</CardTitle>
          <CardDescription>Information of the 100 most recently starred repos.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <Suspense fallback={<RepositorySkeleton />}>
            <Await resolve={value}>
              <RepositoryList />
            </Await>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsPage;
