import { GITHUB_FETCH_STARRED_REPO_LIST_EVENT } from './constants';

import { queryStarredRepoList } from './service';
import { initDB, insertRepoList } from './database';

export class Github {
  private async fetchRepoList(url?: string) {
    try {
      const { data, pagination } = await queryStarredRepoList({
        url,
      });
      console.debug('[worker] Github:fetchRepoList:data', data);

      const db = await initDB();
      const failed = await insertRepoList(db, data);

      const next = pagination.next;
      console.debug('[worker] Github:fetchRepoList:next', next);

      return {
        next,
        failed,
      };
    } catch (error) {
      console.debug('[worker] Github:fetchRepoList:error', error);
    }
  }

  private async messageHandler(event: MessageEvent, callback: (data: any) => void) {
    const { data } = event;
    console.debug('[worker] Github:messageHandler:data', data);

    let hasNext = true;
    let nextUrl = undefined;

    while (hasNext) {
      const res = await this.fetchRepoList(nextUrl);
      if (res?.failed && res.failed > 2) {
        break;
      }

      nextUrl = res?.next;
      hasNext = Boolean(nextUrl);
    }

    callback({
      type: GITHUB_FETCH_STARRED_REPO_LIST_EVENT,
      payload: {
        status: 'done',
      },
    });
  }

  async handleMessage(event: MessageEvent, callback: (data: any) => void) {
    console.debug('[worker] Github:handleMessage:event', event);
    if (event.data?.type !== GITHUB_FETCH_STARRED_REPO_LIST_EVENT) {
      return;
    }

    this.messageHandler(event, callback);
  }
}
