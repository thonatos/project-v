import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

import { createHash } from 'node:crypto';
import { ArtusXInjectEnum } from '@artusx/utils';
import { Inject, Injectable, ArtusInjectEnum } from '@artusx/core';

import { TelegramClient } from '../types';
import { ITelegramClient } from '../plugins';

@Injectable()
export default class TelegramService {
  @Inject(ArtusInjectEnum.Config)
  config: any;

  @Inject(ArtusXInjectEnum.Telegram)
  telegramClient: ITelegramClient;

  get telegram(): TelegramClient {
    return this.telegramClient.getClient();
  }

  async processThumb(data: string) {
    const { cacheDir } = this.config.cache;

    let file = '';
    let thumb = '';

    if (data) {
      const buff = Buffer.from(data, 'base64');
      const hash = createHash('sha256');
      const digest = hash.update(buff).digest('hex');
      const fileBuf = await sharp(buff).resize(800).toBuffer();

      const thumbBuff = await sharp(buff)
        .resize({
          width: 320,
          height: 320,
          fit: 'inside',
        })
        .toBuffer();

      file = path.join(cacheDir, `${digest}.jpg`);
      thumb = path.join(cacheDir, `${digest}_thumb.jpg`);

      fs.writeFileSync(file, fileBuf);
      fs.writeFileSync(thumb, thumbBuff);
    }

    return {
      file,
      thumb,
    };
  }

  async clearCache(files: string[] = []) {
    files.forEach((file) => {
      if (!file) {
        return;
      }
      fs.rmSync(file, { force: true });
    });
  }

  async notify(to: string, data?: any, clear?: boolean) {
    if (!data) {
      return;
    }

    const { file, thumb } = await this.processThumb(data.thumb);

    const message = await this.telegram.sendMessage(to, {
      file: file,
      thumb: thumb,
      message: data.message,
      parseMode: 'html',
      silent: true,
    });

    await this.clearCache([file, thumb]);

    if (!clear) {
      return;
    }

    setTimeout(() => {
      message.delete({
        revoke: true,
      });
    }, 5 * 1000);
  }
}
