export { default as IPPTRClient, PPTRConfig as IPPTRConfig, KnownDevices } from '@artusx/plugin-pptr/client';

export { default as IRedisClient, RedisConfig as IRedisConfig } from '@artusx/plugin-redis/client';

export {
  default as ITelegramClient,
  TelegramConfig as ITelegramConfig,
} from '@artusx/plugin-telegram/client';

export { default as IOpenAIClient, OpenAIConfig as IOpenAIConfig } from '@artusx/plugin-openai/client';

export { default as IClickHouseClient, ClickHouseConfig as IClickHouseConfig } from './plugin/clickhouse';
