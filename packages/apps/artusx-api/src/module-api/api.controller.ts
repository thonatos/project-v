import { ArtusXInjectEnum } from '@artusx/utils';
import { Controller, GET, Inject } from '@artusx/core';
import type { ArtusXContext, NunjucksClient } from '@artusx/core';

@Controller('/api')
export default class ApiController {
  @Inject(ArtusXInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @GET('/')
  async home(ctx: ArtusXContext) {
    ctx.body = this.nunjucks.render('index.html', { title: 'ArtusX', message: 'Hello ArtusX!' });
  }
}
