import { PluginInjectEnum } from '@artusx/utils';
import { ContentType, Controller, GET, Inject } from '@artusx/core';
import type { ArtusXContext, NunjucksClient } from '@artusx/core';
import StrategyService from '../service/strategy';

@Controller('/api')
export default class ApiController {
  @Inject(PluginInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @Inject(StrategyService)
  strategyService: StrategyService;

  @GET('/')
  async home(ctx: ArtusXContext) {
    ctx.body = this.nunjucks.render('index.html', { title: 'ArtusX', message: 'Hello ArtusX!' });
  }

  @GET('/strategies')
  @ContentType('application/json; charset=utf-8')
  async strategies(ctx: ArtusXContext) {
    const data = await this.strategyService.listStrategy();
    ctx.body = data;
  }
}
