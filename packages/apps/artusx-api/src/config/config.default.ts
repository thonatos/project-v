import path from 'path';
import { ArtusxConfig, NunjucksConfigureOptions } from '@artusx/core';
import { getApiId, getProxy, getEnv } from '../util';
import { IPPTRConfig, IOpenAIConfig, ITelegramConfig, IRedisConfig, ISequelizeConfig } from '../plugins';

export default () => {
  const cache = {
    cacheDir: path.join(process.cwd(), '.cache'),
  };

  const artusx: ArtusxConfig = {
    port: 7001,
    static: {
      prefix: '/public/',
      dir: path.resolve(__dirname, '../public'),
    },
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

  const sequelize: ISequelizeConfig = {
    port: getEnv('MYSQL_PORT', 'number') || 3306,
    host: getEnv('MYSQL_HOST', 'string') || 'localhost',

    database: getEnv('MYSQL_DATABASE', 'string') || 'mysql',
    username: getEnv('MYSQL_USERNAME', 'string') || 'root',
    password: getEnv('MYSQL_PASSWORD', 'string') || 'root',

    dialect: 'mysql',
    models: [path.join(__dirname, '../model')],

    force: getEnv('MYSQL_FORCE', 'boolean') || false,
    alter: getEnv('MYSQL_ALTER', 'boolean') || false,
  };

  const openai: IOpenAIConfig = {
    apiKey: getEnv('OPENAI_KEY', 'string') || '',
  };

  const proxy = {
    proxyString: getEnv('PROXY_STRING', 'string') || '',
  };

  const telegram: Record<string, any> & ITelegramConfig = {
    api_id: getApiId() || 0,
    api_hash: getEnv('API_HASH', 'string') || '',
    app_title: getEnv('APP_TITLE', 'string') || '',
    session_string: getEnv('SESSION_STRING', 'string') || '',

    proxy: getProxy(),

    channel: getEnv('TELEGRAM_CHANNEL', 'string') || '',
    bot_auth_token: getEnv('BOT_AUTH_TOKEN', 'string') || '',
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

  return {
    pptr,
    proxy,
    cache,
    artusx,
    openai,
    telegram,
    nunjucks,
    redis,
    sequelize,
  };
};
