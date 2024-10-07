import { PluginInjectEnum } from '@artusx/utils';
import { Inject, Injectable } from '@artusx/core';
import type { Log4jsClient } from '@artusx/core';

import { TZ_ASIA_SHANGHAI } from '../constants';
import { dayjs } from '../util';

import type { Redis } from '@artusx/plugin-redis/types';
import type PluginRedis from '@artusx/plugin-redis/client';
import type PPTRClient from '@artusx/plugin-pptr/client';
import { KnownDevices } from '@artusx/plugin-pptr/client';

const iPhone13Pro = KnownDevices['iPhone 13 Pro Max'];

@Injectable()
export default class NewsService {
  @Inject(PluginInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(PluginInjectEnum.PPTR)
  pptrClient: PPTRClient;

  @Inject(PluginInjectEnum.Redis)
  redisClient: PluginRedis;

  get redis(): Redis {
    return this.redisClient.getClient();
  }

  get logger() {
    return this.log4js.getLogger('default');
  }

  async fetchNewsList() {
    const browser = await this.pptrClient.getBrowser();
    const newsList: NewsDetail[] = [];

    if (!browser) {
      return newsList;
    }

    const page = await browser.newPage();
    await page.emulate(iPhone13Pro);
    await page.goto('https://www.jin10.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const list = await page.$$('.jin-flash-item-container');

    await Promise.all(
      list.map(async (item) => {
        if (!item) {
          return;
        }

        const itemEvaluate = await page.evaluateHandle((item) => {
          const id = item.id;
          const itemTime = item.querySelector('.item-time');
          const itemRight = item.querySelector('.item-right');

          const time = itemTime?.textContent?.trim() || '';
          const dateString = id.replaceAll('flash', '').substring(0, 8);

          const year = dateString.substring(0, 4);
          const month = dateString.substring(4, 6);
          const day = dateString.substring(6, 8);

          const dateTime = `${year}-${month}-${day} ${time}`;

          return {
            id,
            time,
            dateTime,
            content: itemRight?.textContent?.trim() || '',

            isVip: !!item?.querySelector('.is-vip'),
            isRili: !!item?.querySelector('.jin-flash-item.rili'),
            isFlash: !!item?.querySelector('.jin-flash-item.flash'),
            isArticle: !!item?.querySelector('.jin-flash-item.article'),
          };
        }, item);

        const itemData = await itemEvaluate.jsonValue();

        newsList.push(itemData);
      })
    );

    // this.logger.info('fetchNewsList:newsList:total', newsList.length);
    return newsList;
  }

  async batchFetchNewsDetail(items: NewsDetail[], callback: (data: any) => Promise<void>) {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(1);
    const tasks: any[] = [];

    for (const item of items) {
      const cached = await this.redis.get(item.id);

      // skip
      if (cached) {
        continue;
      }

      // only fetch news in 1m
      const current = dayjs().tz(TZ_ASIA_SHANGHAI);
      const created = dayjs.tz(item.dateTime, TZ_ASIA_SHANGHAI);
      const diff = current.diff(created, 'second');

      if (item.isVip || item.isArticle || diff > 60) {
        await this.redis.set(item.id, item.id, 'EX', 120);
        continue;
      }

      this.redis.set(item.id, item.id, 'EX', 120);

      const task = limit(async () => {
        try {
          const detail = await this.fetchNewsDetail(item.id);

          if (!detail) {
            return;
          }

          // rili
          if (item.isRili) {
            if (!item.content || !detail.thumb) {
              return;
            }

            callback({
              message: item.content,
              thumb: detail.thumb,
            });

            return;
          }

          if (!detail.title) {
            return;
          }

          let message = detail.title;

          if (detail.flashRemarkUrl) {
            message += ` —— <a href="${detail.flashRemarkUrl}">相关链接</a>`;
          }

          await callback({
            message,
            thumb: detail.thumb,
          });
        } catch (error) {
          this.logger.error('task:error', item, error);
        }
      });

      tasks.push(task);
    }

    this.logger.info('batchFetchNewsDetail:task:total', tasks.length);

    await Promise.all(tasks);
  }

  async fetchNewsDetail(id: string) {
    const browser = await this.pptrClient.getBrowser();
    if (!browser) {
      return;
    }

    const detailId = id.replaceAll('flash', '');
    const targetUrl = `https://flash.jin10.com/detail/${detailId}`;

    const page = await browser.newPage();
    await page.emulate(iPhone13Pro);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const detailHandler = await page.$('.detail-content');

    const detailEvaluate = await page.evaluateHandle((detailHandler) => {
      const contentTime = detailHandler?.querySelector('.content-time');
      const contentTitle = detailHandler?.querySelector('.content-title');
      const riliContent = detailHandler?.querySelector('.rili-content');
      const flashRemark = detailHandler?.querySelector('.flash-remark');

      // remove flash remark
      flashRemark?.remove();

      // get flash remark url
      const flashRemarkUrl = flashRemark?.querySelector('a.remark-item')?.getAttribute('href');

      return {
        title: contentTitle?.textContent?.trim() || '',
        riliContent: riliContent?.textContent?.trim() || '',
        dateTimeString: contentTime?.textContent?.trim() || '',
        flashRemarkUrl: flashRemarkUrl || '',
      };
    }, detailHandler);

    const thumb = (await detailHandler?.screenshot({
      omitBackground: false,
      encoding: 'binary',
      type: 'jpeg',
      quality: 100,
    })) as Buffer | undefined;

    const detailObject = await detailEvaluate.jsonValue();

    return {
      id,
      url: targetUrl,
      thumb: thumb?.toString('base64'),
      title: detailObject.title,
      dateTimeString: detailObject.dateTimeString,
      flashRemarkUrl: detailObject.flashRemarkUrl,
    };
  }

  async fetchRiliDetail() {
    const browser = await this.pptrClient.getBrowser();

    if (!browser) {
      return;
    }

    const targetUrl = 'https://rili.jin10.com/';

    const page = await browser.newPage();
    await page.emulate({
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const jinLayout = await page.$('.jin-layout');

    await page.evaluateHandle((jinLayout) => {
      jinLayout?.querySelector('.jin-header')?.remove();

      jinLayout?.querySelector('.jin-layout-content > .media-wrap > .top-tips')?.remove();

      jinLayout
        ?.querySelector(
          '.jin-layout-content > .media-wrap > .jin-layout-content__left > .index-page > .index-page-header__wrap'
        )
        ?.remove();

      jinLayout?.querySelector('.table-header__right')?.remove();
    }, jinLayout);

    const riliHandler = await page.$(
      '.jin-layout > .jin-layout-content > .media-wrap > .jin-layout-content__left'
    );

    const boundingBox = await riliHandler?.boundingBox();

    const riliThumb = (await page?.screenshot({
      omitBackground: false,
      encoding: 'binary',
      type: 'jpeg',
      quality: 100,
      fullPage: false,
      clip: {
        x: boundingBox?.x || 0,
        y: boundingBox?.y || 0,
        width: boundingBox?.width || 0,
        height: boundingBox?.height || 0,
      },
    })) as Buffer | undefined;

    return {
      url: targetUrl,
      riliThumb: riliThumb?.toString('base64'),
    };
  }
}

export interface NewsDetail {
  id: string;
  time: string;
  content: string;
  dateTime: string;

  isVip: boolean;
  isRili: boolean;
  isFlash: boolean;
  isArticle: boolean;
}
