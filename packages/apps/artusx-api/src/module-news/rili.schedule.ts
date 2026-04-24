import type { ArtusXSchedule, Log4jsClient } from '@artusx/core';
import { ArtusInjectEnum, Inject, Schedule } from '@artusx/core';
import { PluginInjectEnum } from '@artusx/utils';
import dayjs from 'dayjs';
import TelegramService from '../service/telegram';
import NewsService from './news.service';
import type { AppConfig } from '../types/config';

@Schedule({
  enable: false,
  cron: '0 9 * * *',
  runOnInit: false,
})
export default class RiliSchedule implements ArtusXSchedule {
  @Inject(ArtusInjectEnum.Config)
  config: AppConfig;

  @Inject(PluginInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(NewsService)
  newsService: NewsService;

  @Inject(TelegramService)
  telegramService: TelegramService;

  get channel() {
    return this.config.channels.news;
  }

  get logger() {
    return this.log4js.getLogger('default');
  }

  async run() {
    const channel = this.channel;
    const rili = await this.newsService.fetchRiliDetail();

    this.logger.info('schedule:rili:url', rili?.url);

    if (!rili?.riliThumb) {
      return;
    }

    const message = `${dayjs().format('YYYY-MM-DD')} 财经日历 —— <a href="${rili.url}">点击查看</a)}`;

    await this.telegramService.sendMessage(channel, {
      message,
      thumb: rili.riliThumb,
    });
  }
}
