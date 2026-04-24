import type { ArtusXContext, NunjucksClient } from '@artusx/core';
import { Controller, GET, Inject } from '@artusx/core';
import { PluginInjectEnum } from '@artusx/utils';

const content = `
User-agent: *
Disallow: /
`;

@Controller()
export default class HomeController {
  @Inject(PluginInjectEnum.Nunjucks)
  nunjucks: NunjucksClient;

  @GET('/')
  async home(ctx: ArtusXContext) {
    ctx.body = this.nunjucks.render('index.html', {
      title: 'ArtusX',
      message: 'Hello ArtusX!',
    });
  }

  @GET('/Robots.txt')
  async robots(ctx: ArtusXContext) {
    ctx.body = content;
  }
}
