import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { sendMessageToSW } from '~/lib/utils';
import {
  initDB,
  getRepoList,
  EVENT_FETCH_STARRED_REPO_LIST,
  TIME_FETCH_STARRED_REPO_LIST,
} from '~/github-module';

import type { GithubRepository } from '~/github-module';

export const logger = debug('store:githubAtom');
export const loadingAtom = atom<boolean>(false);
export const recordAtom = atomWithStorage<number | undefined>(
  TIME_FETCH_STARRED_REPO_LIST,
  undefined,
  undefined,
  {
    getOnInit: true,
  }
);
export const repoAtom = atom<GithubRepository[]>([]);

export const githubAtom = atom<
  Promise<{ repositories: GithubRepository[] }>,
  [
    | {
        pageNumber: number;
        pageSize?: number;
      }
    | undefined
  ],
  void
>(
  async (get) => {
    return {
      repositories: get(repoAtom),
    };
  },
  async (get, set, options) => {
    const current_time = Date.now();
    const last_reqeust_time = get(recordAtom);

    if (!!get(loadingAtom)) {
      return;
    }

    if (!last_reqeust_time || current_time - last_reqeust_time > 1000 * 60 * 60) {
      sendMessageToSW(EVENT_FETCH_STARRED_REPO_LIST, options);
      set(recordAtom, current_time);
    }

    set(loadingAtom, true);

    const db = await initDB();
    const data = await getRepoList(db);

    logger('githubAtom:data', data.length);

    set(repoAtom, data);
    set(loadingAtom, false);
    set(recordAtom, current_time);
  }
);
