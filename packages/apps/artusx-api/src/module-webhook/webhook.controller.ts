import { ArtusXInjectEnum } from '@artusx/utils';
import { Controller, POST, Inject, MW, ArtusInjectEnum } from '@artusx/core';
import type { ArtusxContext, Log4jsClient, NunjucksClient } from '@artusx/core';

import TelegramService from '../service/telegram';
import checkAuthToken from './auth.middleware';

@Controller('/webhook')
export default class WebhookController {
  @Inject(ArtusInjectEnum.Config)
  config: Record<string, any>;

  @Inject(ArtusXInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(ArtusXInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @Inject(TelegramService)
  telegramService: TelegramService;

  get logger() {
    return this.log4js.getLogger('default');
  }

  @MW([checkAuthToken])
  @POST('/madrid')
  async madrid(ctx: ArtusxContext) {
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
  async info(ctx: ArtusxContext) {
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
  async idea(ctx: ArtusxContext) {
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
