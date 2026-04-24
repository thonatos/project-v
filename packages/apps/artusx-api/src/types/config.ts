import type { ArtusXConfig, NunjucksConfigureOptions } from '@artusx/core';
import type { ClickHouseConfig } from '@artusx/plugin-clickhouse/client';
import type { OpenAIConfig } from '@artusx/plugin-openai/client';
import type { PPTRConfig } from '@artusx/plugin-pptr/client';
import type { RedisConfig } from '@artusx/plugin-redis/client';
import type { TelegramConfig } from '@artusx/plugin-telegram/client';

export interface AppConfig {
  pptr: PPTRConfig;
  proxy: {
    proxyString: string;
  };
  cache: {
    cacheDir: string;
  };
  artusx: ArtusXConfig;
  openai: OpenAIConfig;
  telegram: TelegramConfig;
  nunjucks: NunjucksConfigureOptions;
  redis: RedisConfig;
  socketio: {
    path: string;
  };
  clickhouse: ClickHouseConfig;
  channels: {
    news: string;
    info: string;
    idea: string;
  };
}
