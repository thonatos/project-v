import path from 'path';
import { getApiId, getProxy, getEnv } from '@artusx/utils';
import { ArtusXConfig, NunjucksConfigureOptions } from '@artusx/core';

import type { PPTRConfig } from '@artusx/plugin-pptr/client';
import type { RedisConfig } from '@artusx/plugin-redis/client';
import type { OpenAIConfig } from '@artusx/plugin-openai/client';
import type { TelegramConfig } from '@artusx/plugin-telegram/client';
import type { ClickHouseConfig } from '@artusx/plugin-clickhouse/client';

export default () => {
  const cache = {
    cacheDir: path.join(process.cwd(), '.cache'),
  };

  const artusx: ArtusXConfig = {
    port: 7001,
    static: {
      prefix: '/public/',
      dir: path.resolve(__dirname, '../public'),
    },
    cors: {
      origin: '*',
      credentials: true,
      allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
    },
  };

  const socketio = {
    path: '/socket.io',
  };

  const nunjucks: NunjucksConfigureOptions = {
    path: path.resolve(__dirname, '../view'),
    options: {
      autoescape: true,
      noCache: true,
    },
  };

  const redis: RedisConfig = {
    db: getEnv('REDIS_DATABASE', 'number') || 0,
    port: getEnv('REDIS_PORT', 'number') || 6379,
    host: getEnv('REDIS_HOST', 'string') || 'localhost',

    username: getEnv('REDIS_USERNAME', 'string') || '',
    password: getEnv('REDIS_PASSWORD', 'string') || '',
  };

  const clickhouse: ClickHouseConfig = {
    url: getEnv('CLICKHOUSE_URL', 'string') || 'clickhouse:8123',
    username: getEnv('CLICKHOUSE_USERNAME', 'string') || 'default',
    password: getEnv('CLICKHOUSE_PASSWORD', 'string') || '',
    database: getEnv('CLICKHOUSE_DATABASE', 'string') || 'default',
  };

  const openai: OpenAIConfig = {
    apiKey: getEnv('OPENAI_KEY', 'string') || '',
  };

  const proxy = {
    proxyString: getEnv('PROXY_STRING', 'string') || '',
  };

  const telegram: TelegramConfig = {
    api_id: getApiId() || 0,
    api_hash: getEnv('API_HASH', 'string') || '',
    app_title: getEnv('APP_TITLE', 'string') || '',
    session_string: getEnv('SESSION_STRING', 'string') || '',
    bot_auth_token: getEnv('BOT_AUTH_TOKEN', 'string') || '',
    proxy: getProxy() || undefined,
  };

  const pptr: PPTRConfig = {
    connect: {
      browserWSEndpoint: getEnv('BROWSERLESS_URL', 'string') || 'ws://localhost:3000',
      protocolTimeout: 30000,
      defaultViewport: {
        width: 1440,
        height: 810,
        deviceScaleFactor: 1,
      },
    },
  };

  const channels = {
    news: getEnv('TELEGRAM_CHANNEL_NEWS', 'string') || '',
    info: getEnv('TELEGRAM_CHANNEL_INFO', 'string') || '',
    idea: getEnv('TELEGRAM_CHANNEL_IDEA', 'string') || '',
  };

  return {
    pptr,
    proxy,
    cache,
    artusx,
    openai,
    telegram,
    nunjucks,
    redis,
    socketio,
    clickhouse,

    // custom
    channels,
  };
};
