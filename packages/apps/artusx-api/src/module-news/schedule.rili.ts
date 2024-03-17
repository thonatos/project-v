import dayjs from 'dayjs';
import { ArtusXInjectEnum } from '@artusx/utils';
import { ArtusInjectEnum, Inject, Schedule } from '@artusx/core';
import type { ArtusxSchedule, Log4jsClient } from '@artusx/core';

import NewsService from './serivice.news';
import TelegramService from 'src/service/telegram';

@Schedule({
  enable: true,
  cron: '0 9 * * *',
  runOnInit: false,
})
export default class RiliSchedule implements ArtusxSchedule {
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

  async fetch() {
    const targetChannel = this.channel;

    const rili = await this.newsService.fetchRili();

    this.logger.info('schedule:fetch:rili', rili?.url);

    if (!rili?.riliThumb) {
      return;
    }

    const message = `${dayjs().format('YYYY-MM-DD')} 财经日历 —— <a href="${rili.url}">点击查看</a)}`;

    await this.telegramService.notify(targetChannel, {
      message,
      thumb: rili.riliThumb,
    });
  }

  async run() {
    await this.fetch();
  }
}