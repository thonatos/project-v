import { queryStarredRepoList } from './service';
import { initDB, insertRepoList } from './database';
import { EVENT_FETCH_STARRED_REPO_LIST } from './constants';

export class StarredRepoMessageHandler {
  private async fetchRepoList(url?: string) {
    try {
      const { data, pagination } = await queryStarredRepoList({
        url,
      });
      // console.log('StarredRepoMessageHandler:data', data);

      const db = await initDB();
      const failed = await insertRepoList(db, data);

      const next = pagination.next;
      console.log('[sw] StarredRepoMessageHandler:next', next);

      return {
        next,
        failed,
      };
    } catch (error) {
      console.log('[sw] StarredRepoMessageHandler:error', error);
    }
  }

  private async messageHandler(event: ExtendableMessageEvent) {
    const { data } = event;
    console.log('[sw] StarredRepoMessageHandler:data', data);

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

    event.source?.postMessage({
      type: EVENT_FETCH_STARRED_REPO_LIST,
      payload: {
        status: 'done',
      },
    });
  }

  async handleMessage(event: ExtendableMessageEvent) {
    if (event.data?.type !== EVENT_FETCH_STARRED_REPO_LIST) {
      return;
    }

    this.messageHandler(event);
  }
}
