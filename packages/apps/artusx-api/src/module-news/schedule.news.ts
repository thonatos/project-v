import dayjs from 'dayjs';
import { ArtusXInjectEnum } from '@artusx/utils';
import { Inject, Schedule, ArtusInjectEnum } from '@artusx/core';
import type { ArtusxSchedule, Log4jsClient } from '@artusx/core';

import { Redis } from '../types';
import { IRedisClient } from '../plugins';

import NewsService from './serivice.news';
import TelegramService from '../service/telegram';

@Schedule({
  enable: true,
  cron: '*/30 * * * * *',
  runOnInit: true,
})
export default class NewsSchedule implements ArtusxSchedule {
  @Inject(ArtusInjectEnum.Config)
  config: Record<string, any>;

  @Inject(ArtusXInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(ArtusXInjectEnum.Redis)
  redisClient: IRedisClient;

  @Inject(NewsService)
  newsService: NewsService;

  @Inject(TelegramService)
  telegramService: TelegramService;

  get channel() {
    return this.config.telegram.channel;
  }

  get redis(): Redis {
    return this.redisClient.getClient();
  }

  get logger() {
    return this.log4js.getLogger('default');
  }

  async fetch() {
    const targetChannel = this.channel;

    const news = (await this.newsService.fetchNews()) || [];
    this.logger.info('schedule:fetch:news', news.length);

    await Promise.all(
      news.map(async (item) => {
        const cached = await this.redis.get(item.id);

        if (cached) {
          return;
        }

        const current = dayjs();
        const created = dayjs(item.dateTime);
        const diff = current.diff(created, 'second');

        if (item.isVip || item.isArticle || diff > 60) {
          await this.redis.set(item.id, item.id, 'EX', 120);
          return;
        }

        try {
          const detail = await this.newsService.fetchNewsDetail(item.id);

          this.redis.set(item.id, item.id, 'EX', 120);

          if (!detail) {
            return;
          }

          // rili
          if (item.isRili) {
            if (!item.content || !detail.thumb) {
              return;
            }

            await this.telegramService.notify(targetChannel, {
              message: item.content,
              thumb: detail.thumb,
            });

            return;
          }

          if (!detail.title) {
            return;
          }

          let message = detail.title;

          if (detail.flashRemarkUrl) {
            message += ` —— <a href="${detail.flashRemarkUrl}">相关链接</a>`;
          }

          await this.telegramService.notify(targetChannel, {
            message,
            thumb: detail.thumb,
          });
        } catch (error) {
          this.logger.info('schedule:fetch:error', error);
        }
      })
    );

    await this.newsService.clearPages();
  }

  async run() {
    await this.fetch();
  }
}
