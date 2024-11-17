import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { logger } from '~/lib/utils';
import { githubAtom } from '~/store/githubAtom';
import { useServiceWorker } from '~/hooks/use-service-worker';
import { RepositoryCard } from './repository-card';
import { EVENT_FETCH_STARRED_REPO_LIST } from '~/github-module';

export const RepositoryList: React.FC<{}> = () => {
  const { sw } = useServiceWorker();
  const [{ repositories = [] }, dispach] = useAtom(githubAtom);

  useEffect(() => {
    if (!sw) {
      return;
    }

    sw.addEventListener('message', (event) => {
      logger.log('[pwa] sw:message from worker', event);

      const { type, payload } = event.data;

      if (type === EVENT_FETCH_STARRED_REPO_LIST && payload?.status === 'done') {
        dispach({
          pageNumber: 1,
        });
      }
    });

    return () => {
      sw.removeEventListener('message', () => {});
    };
  }, [sw]);

  useEffect(() => {
    dispach({
      pageNumber: 1,
    });
  }, []);

  if (!repositories?.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
      {repositories.map((item) => {
        return <RepositoryCard key={item.id} repo={item} />;
      })}
    </div>
  );
};

export default RepositoryList;
