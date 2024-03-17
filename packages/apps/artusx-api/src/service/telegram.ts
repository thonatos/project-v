import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

import { createHash } from 'node:crypto';

import { Inject, Injectable, ArtusInjectEnum } from '@artusx/core';

import { ArtusXInjectEnum } from '@artusx/utils';

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

  async notify(to: string, data?: any, clear?: boolean) {
    const { cacheDir } = this.config;

    if (!data) {
      return;
    }

    let file = '';
    let fileThumb = '';

    if (data.thumb) {
      const buff = Buffer.from(data.thumb, 'base64');
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
      fileThumb = path.join(cacheDir, `${digest}_thumb.jpg`);

      fs.writeFileSync(file, fileBuf);
      fs.writeFileSync(fileThumb, thumbBuff);
    }

    const message = await this.telegram.sendMessage(to, {
      file: file,
      thumb: fileThumb,
      message: data.message,
      parseMode: 'html',
      silent: true,
    });

    if (file) {
      fs.rmSync(file, { force: true });
    }

    if (fileThumb) {
      fs.rmSync(fileThumb, { force: true });
    }

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
