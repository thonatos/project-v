import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { Repository } from '~/components/biz/repository-card';

export const logger = debug('store:githubAtom');
export const loadingAtom = atom<boolean>(false);
export const recordAtom = atomWithStorage<number>('github_request_timestamp', Date.now() / 1000);
export const repositoryAtom = atomWithStorage<Repository[]>('github_starred_repositories', []);

export const githubAtom = atom(
  async (get) => {
    return {
      repositories: get(repositoryAtom),
    };
  },
  async (get, set) => {
    const current = Date.now() / 1000;
    const last_request_timestamp = get(recordAtom) || 0;

    logger('githubAtom:current', current);
    logger('githubAtom:last_request_timestamp', last_request_timestamp);
    logger('githubAtom:passed_time', current - last_request_timestamp);

    if (current - last_request_timestamp < 30000) {
      logger('githubAtom:skip', current - last_request_timestamp);
      return;
    }

    try {
      const params: any = {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
        },
      };

      set(loadingAtom, true);

      const res = await fetch(`https://api.github.com/users/thonatos/starred?per_page=100&page=1`, params);
      const data = await res.json();
      logger('githubAtom:data', data);

      set(recordAtom, current);
      set(repositoryAtom, data);
    } catch (error) {
      logger('githubAtom:error', error);
    } finally {
      set(loadingAtom, false);
    }
  }
);
