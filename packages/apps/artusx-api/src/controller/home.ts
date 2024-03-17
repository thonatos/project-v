import { ArtusXInjectEnum } from '@artusx/utils';
import { Controller, GET, POST, Inject } from '@artusx/core';
import type { ArtusxContext, NunjucksClient } from '@artusx/core';

import TelegramService from '../service/telegram';

@Controller()
export default class HomeController {
  @Inject(ArtusXInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @Inject(TelegramService)
  telegramService: TelegramService;

  @GET('/')
  @POST('/')
  async home(ctx: ArtusxContext) {
    ctx.body = this.nunjucks.render('index.html', { title: 'ArtusX', message: 'Hello ArtusX!' });
  }

  @GET('/health')
  async health(ctx: ArtusxContext) {
    await this.telegramService.notify(
      'sufunds_idea',
      {
        message: 'Health Check',
      },
      true
    );

    ctx.body = 'OK';
  }
}
