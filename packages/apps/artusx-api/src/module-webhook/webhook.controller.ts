import type { ArtusXContext, Log4jsClient, NunjucksClient } from '@artusx/core';
import { ArtusInjectEnum, Controller, Inject, MW, POST } from '@artusx/core';
import { PluginInjectEnum } from '@artusx/utils';

import TelegramService from '../service/telegram';
import checkAuthToken from './auth.middleware';
import type { AppConfig } from '../types/config';

@Controller('/webhook')
export default class WebhookController {
  @Inject(ArtusInjectEnum.Config)
  config: AppConfig;

  @Inject(PluginInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(PluginInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @Inject(TelegramService)
  telegramService: TelegramService;

  get logger() {
    return this.log4js.getLogger('default');
  }

  @MW([checkAuthToken])
  @POST('/madrid')
  async madrid(ctx: ArtusXContext) {
    const body = ctx.request.body;
    const channel = this.config.channels.info;

    try {
      const message = this.nunjucks.render('template/madrid.html', body);
      this.telegramService.sendMessage(channel, {
        message,
        parseMode: 'html',
      });
    } catch (error) {
      this.logger.error(error);
    }

    ctx.body = 'done';
  }

  @MW([checkAuthToken])
  @POST('/info')
  async info(ctx: ArtusXContext) {
    const body = ctx.request.body;
    const channel = this.config.channels.info;

    try {
      const message = this.nunjucks.render('template/info.html', body);
      this.telegramService.sendMessage(channel, {
        message,
        parseMode: 'html',
      });
    } catch (error) {
      this.logger.error(error);
    }

    ctx.body = 'done';
  }

  @MW([checkAuthToken])
  @POST('/idea')
  async idea(ctx: ArtusXContext) {
    const channel = this.config.channels.idea;
    const { message } = ctx.request.body;

    try {
      if (message) {
        this.telegramService.sendMessage(channel, {
          message,
          parseMode: 'html',
        });
      }
    } catch (error) {
      this.logger.error(error);
    }

    ctx.body = 'done';
  }
}
