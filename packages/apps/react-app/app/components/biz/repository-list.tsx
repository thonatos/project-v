import { useEffect, useState, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';

import { RepositoryCard } from './repository-card';
import { GITHUB_FETCH_STARRED_REPO_LIST_EVENT, type GithubRepo } from '~/modules/github';
import { loadRepoAtom, recordAtom, filterRepoAtom } from '~/store/githubAtom';

export const RepositoryList = () => {
  const worker = useRef<Worker | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const loadRepo = useSetAtom(loadRepoAtom);
  const lastReqeustTime = useAtomValue(recordAtom);
  const updateLastReqeustTime = useSetAtom(recordAtom);
  const { repositories } = useAtomValue(filterRepoAtom);

  const shouldUpdate = () => {
    const current_time = Date.now();
    if (!lastReqeustTime || current_time - lastReqeustTime > 1000 * 60 * 60) {
      return true;
    }
    return false;
  };

  const refreshRepoAtom = () => {
    setLoading(false);
    loadRepo();
  };

  useEffect(() => {
    if (worker.current) {
      return;
    }

    worker.current = new Worker(new URL('~/worker.ts', import.meta.url), { type: 'module' });

    worker.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === GITHUB_FETCH_STARRED_REPO_LIST_EVENT && payload?.status === 'done') {
        refreshRepoAtom();
      }
    };

    worker.current.onerror = (e) => {
      console.error('worker:error', e);
    };
  }, []);

  useEffect(() => {
    console.debug('GithubStarsPage useEffect');
    if (!worker.current || loading) {
      return;
    }

    const current_time = Date.now();
    const _shouldUpdate = shouldUpdate();

    // check if we should update the starred repo list
    if (!_shouldUpdate) {
      refreshRepoAtom();
      return;
    }

    // use web worker to fetch starred repo list
    updateLastReqeustTime(current_time);
    setLoading(true);

    worker.current.postMessage({
      type: GITHUB_FETCH_STARRED_REPO_LIST_EVENT,
      payload: {},
    });
  }, []);

  if (!repositories?.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
      {repositories.map((item: GithubRepo) => {
        return <RepositoryCard key={item.id} repo={item} />;
      })}
    </div>
  );
};

export default RepositoryList;
