import { ArtusXInjectEnum } from '@artusx/utils';
import { Controller, GET, Inject } from '@artusx/core';
import type { ArtusxContext, NunjucksClient } from '@artusx/core';

const content = `
User-agent: *
Disallow: /
`;

@Controller()
export default class HomeController {
  @Inject(ArtusXInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @GET('/')
  async home(ctx: ArtusxContext) {
    ctx.body = this.nunjucks.render('index.html', { title: 'ArtusX', message: 'Hello ArtusX!' });
  }

  @GET('/Robots.txt')
  async robots(ctx: ArtusxContext) {
    ctx.body = content;
  }
}
