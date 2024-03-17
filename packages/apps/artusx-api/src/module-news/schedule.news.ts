import { ArtusXInjectEnum } from '@artusx/utils';
import { Inject, Schedule, ArtusInjectEnum } from '@artusx/core';
import type { ArtusxSchedule, Log4jsClient } from '@artusx/core';

import NewsService from './serivice.news';
import TelegramService from '../service/telegram';

@Schedule({
  enable: true,
  cron: '*/30 * * * * *',
  runOnInit: false,
})
export default class NewsSchedule implements ArtusxSchedule {
  @Inject(ArtusInjectEnum.Config)
  config: Record<string, any>;

  @Inject(ArtusXInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(NewsService)
  newsService: NewsService;

  @Inject(TelegramService)
  telegramService: TelegramService;

  get channel() {
    return this.config.telegram.channel;
  }

  get logger() {
    return this.log4js.getLogger('default');
  }

  async run() {
    const channel = this.channel;

    try {
      const newsList = await this.newsService.fetchNewsList();
      this.logger.info('schedule:news:newsList', newsList.length);

      await this.newsService.batchFetchNewsDetail(newsList, async (data: any) => {
        if (!data) {
          return;
        }
        await this.telegramService.notify(channel, data);
      });
    } catch (error) {
      this.logger.error('schedule:news:error', error);
    }
  }
}
