import path from 'path';
import { getApiId, getProxy, getEnv } from '@artusx/utils';
import { ArtusXConfig, NunjucksConfigureOptions } from '@artusx/core';
import { IPPTRConfig, IOpenAIConfig, ITelegramConfig, IRedisConfig, IClickHouseConfig } from '../plugins';

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

  const redis: IRedisConfig = {
    db: getEnv('REDIS_DATABASE', 'number') || 0,
    port: getEnv('REDIS_PORT', 'number') || 6379,
    host: getEnv('REDIS_HOST', 'string') || 'localhost',

    username: getEnv('REDIS_USERNAME', 'string') || '',
    password: getEnv('REDIS_PASSWORD', 'string') || '',
  };

  const clickhouse: IClickHouseConfig = {
    url: getEnv('CLICKHOUSE_URL', 'string') || '',
    username: getEnv('CLICKHOUSE_USERNAME', 'string') || 'default',
    password: getEnv('CLICKHOUSE_PASSWORD', 'string') || '',
    database: getEnv('CLICKHOUSE_DATABASE', 'string') || 'default',
  };

  const openai: IOpenAIConfig = {
    apiKey: getEnv('OPENAI_KEY', 'string') || '',
  };

  const proxy = {
    proxyString: getEnv('PROXY_STRING', 'string') || '',
  };

  const telegram: ITelegramConfig = {
    api_id: getApiId() || 0,
    api_hash: getEnv('API_HASH', 'string') || '',
    app_title: getEnv('APP_TITLE', 'string') || '',
    session_string: getEnv('SESSION_STRING', 'string') || '',
    bot_auth_token: getEnv('BOT_AUTH_TOKEN', 'string') || '',
    proxy: getProxy() || undefined,
  };

  const pptr: IPPTRConfig = {
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
