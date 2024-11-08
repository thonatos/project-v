import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { githubAtom } from '~/store/githubAtom';

import { RepositorySkeleton } from '~/components/biz/repository-skeleton';
import { RepositoryCard } from './repository-card';

export const RepositoryList: React.FC<{}> = () => {
  const [{ repositories = [] }, dispach] = useAtom(githubAtom);

  useEffect(() => {
    dispach();
  }, []);

  if (!repositories?.length) {
    return <RepositorySkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
      {repositories.map((item) => {
        return <RepositoryCard key={item.name} repo={item} />;
      })}
    </div>
  );
};

export default RepositoryList;
