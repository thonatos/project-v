import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { sendMessageToSW } from '~/lib/utils';
import {
  initDB,
  getRepoList,
  TIME_FETCH_STARRED_REPO_LIST,
  EVENT_FETCH_STARRED_REPO_LIST,
} from '~/modules/github';

import type { GithubRepository } from '~/modules/github';

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

// repo
const repoLangAtom = atom<
  Array<{
    name: string;
    value: number;
  }>
>([]);
const repoListAtom = atom<GithubRepository[]>([]);

export const loadRepoAtom = atom(
  (get) => {
    return {
      languages: get(repoLangAtom),
      repositories: get(repoListAtom),
    };
  },
  async (
    get,
    set,
    options?: {
      pageNumber: number;
      pageSize?: number;
    }
  ) => {
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
    const { repoList, langList } = await getRepoList(db);

    logger('githubAtom:repoList', repoList.length);

    set(repoListAtom, repoList);
    set(repoLangAtom, langList);
    set(loadingAtom, false);
    set(recordAtom, current_time);
  }
);

// filter
const filterNameAtom = atom('');
const filterLangAtom = atom('');

export const filterRepoAtom = atom(
  (get) => {
    const name = get(filterNameAtom);
    const lang = get(filterLangAtom);
    const repos = get(repoListAtom);

    const filtered = repos.filter((repo) => {
      if (
        name &&
        !repo.name.toLowerCase().includes(name) &&
        !repo.description?.toLowerCase().includes(name)
      ) {
        return false;
      }

      if (lang && repo.language !== lang) {
        return false;
      }

      return true;
    });

    return {
      name,
      lang,
      repositories: filtered,
    };
  },
  (_get, set, value: { name?: string; lang?: string }) => {
    set(filterNameAtom, value.name || '');
    set(filterLangAtom, value.lang || '');
  }
);
