import { ArtusXInjectEnum } from '@artusx/utils';
import { Controller, POST, GET, Inject, MW, ArtusInjectEnum } from '@artusx/core';
import type { ArtusxContext, Log4jsClient, NunjucksClient } from '@artusx/core';

import TelegramService from '../service/telegram';
import checkAuthToken from './auth.middleware';

@Controller('/api/webhook')
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

  get channel() {
    return this.config.channels.info;
  }

  @MW([checkAuthToken])
  @POST('/madrid')
  async madrid(ctx: ArtusxContext) {
    const body = ctx.request.body;
    const channel = this.channel;

    try {
      const message = this.nunjucks.render('tmpl/madrid.html', body);
      this.telegramService.sendMessage(channel, {
        message,
        parseMode: 'Markdown',
      });
    } catch (error) {
      this.logger.error(error);
    }

    ctx.body = 'done';
  }

  @POST('/information')
  async information(ctx: ArtusxContext) {
    const body = ctx.request.body;
    const channel = this.channel;

    try {
      const message = this.nunjucks.render('tmpl/information.html', body);
      this.telegramService.sendMessage(channel, {
        message,
        parseMode: 'Markdown',
      });
    } catch (error) {
      this.logger.error(error);
    }

    ctx.body = 'done';
  }

  @GET('/notify')
  async notify(ctx: ArtusxContext) {
    const channel = this.config.channels.idea;
    await this.telegramService.sendMessage(
      channel,
      {
        message: 'Health Check',
      },
      true
    );
    ctx.body = 'OK';
  }
}
