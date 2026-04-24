import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Log4jsClient } from '@artusx/core';
import { ArtusInjectEnum, Inject, Injectable } from '@artusx/core';
import type PluginTelegram from '@artusx/plugin-telegram/client';
import type { TelegramClient } from '@artusx/plugin-telegram/types';
import { PluginInjectEnum } from '@artusx/utils';
import fs from 'fs-extra';
import sharp from 'sharp';
import type { AppConfig } from '../types/config';

@Injectable()
export default class TelegramService {
  @Inject(ArtusInjectEnum.Config)
  config: AppConfig;

  @Inject(PluginInjectEnum.Log4js)
  log4js: Log4jsClient;

  @Inject(PluginInjectEnum.Telegram)
  telegramClient: PluginTelegram;

  get logger() {
    return this.log4js.getLogger('default');
  }

  get telegram(): TelegramClient {
    return this.telegramClient.getClient();
  }

  async processThumb(data?: string) {
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

  async sendMessage(to: string, data?: Message, clear?: boolean) {
    if (!data) {
      return;
    }

    const { message, parseMode = 'html', silent = true } = data;
    const { file, thumb } = await this.processThumb(data.thumb);

    const msg = await this.telegram.sendMessage(to, {
      file,
      thumb,
      message,
      silent,
      parseMode,
    });

    await this.clearCache([file, thumb]);

    if (!clear) {
      return;
    }

    setTimeout(() => {
      msg.delete({
        revoke: true,
      });
    }, 5 * 1000);
  }
}

export interface Message {
  title?: string;
  message: string;
  thumb?: string;
  silent?: boolean;
  parseMode?: 'html' | 'markdown' | 'markdownv2';
}
