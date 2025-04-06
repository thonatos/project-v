import debug from 'debug';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DATABASE_NAME, DATABASE_STORE_NAME, type GithubRepository } from './constants';

export const logger = debug('database:github');

export interface GithubDB extends DBSchema {
  starred_repositories: {
    key: string;
    value: GithubRepository;
    indexes: {
      id: string;
      updated_at: string;
      pushed_at: string;
    };
  };
}

export const initDB = async () => {
  const db = await openDB<GithubDB>(DATABASE_NAME, 1, {
    upgrade(db) {
      const repoStore = db.createObjectStore(DATABASE_STORE_NAME, {
        keyPath: 'id',
      });
      repoStore.createIndex('id', 'id', { unique: true });
      repoStore.createIndex('pushed_at', 'pushed_at');
      repoStore.createIndex('updated_at', 'updated_at');
    },
  });

  return db;
};

export const insertRepoList = async (db: IDBPDatabase<GithubDB>, data: GithubRepository[]) => {
  let failed = 0;

  const tx = db.transaction(DATABASE_STORE_NAME, 'readwrite');

  for (const item of data) {
    const exist = await tx.store.get(item.id);
    // logger('insertItems:exist', item.id, exist);
    if (!exist) {
      await tx.store.add(item);
    } else {
      failed++;
    }
  }

  await tx.done;

  return failed;
};

export const getRepoById = async (db: IDBPDatabase<GithubDB>, id: string) => {
  return db.get(DATABASE_STORE_NAME, id);
};

export const getRepoList = async (db: IDBPDatabase<GithubDB>) => {
  const list = await db.getAllFromIndex(DATABASE_STORE_NAME, 'pushed_at');

  const sortedList = list.sort((a, b) => {
    return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
  });

  const langMap = new Map<string, number>();

  sortedList.forEach((item) => {
    if (!item.language) {
      return;
    }

    const count = langMap.get(item.language) || 0;
    langMap.set(item.language, count + 1);
  });

  const langList = Array.from(langMap, ([name, value]) => ({ name, value }));

  return {
    langMap,
    langList,
    repoList: sortedList,
  };
};
