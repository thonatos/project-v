import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { initDB, getRepoList } from '~/modules/github';

import type { GithubRepo } from '~/modules/github';

export const logger = debug('store:githubAtom');

export const recordAtom = atomWithStorage<number | undefined>(
  'github_fetch_starred_repo_list_time',
  undefined,
  undefined,
  {
    getOnInit: true,
  }
);

// repo
const repoLangAtom = atom<Array<{ name: string; value: number }>>([]);
const repoListAtom = atom<GithubRepo[]>([]);

export const loadRepoAtom = atom(
  (get) => {
    return {
      languages: get(repoLangAtom),
      repositories: get(repoListAtom),
    };
  },
  async (_get, set) => {
    const db = await initDB();
    const { repoList, langList } = await getRepoList(db);

    logger('githubAtom:repoList', repoList.length);

    set(repoListAtom, repoList);
    set(repoLangAtom, langList);
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
