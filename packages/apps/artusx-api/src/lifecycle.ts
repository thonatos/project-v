import {
  ApplicationLifecycle,
  ArtusApplication,
  ArtusInjectEnum,
  LifecycleHook,
  LifecycleHookUnit,
  Inject,
} from '@artusx/core';
import { ClickHouseConfig, ClickHouseClient } from './plugin/clickhouse';

@LifecycleHookUnit()
export default class CustomLifecycle implements ApplicationLifecycle {
  @Inject(ArtusInjectEnum.Application)
  app: ArtusApplication;

  get logger() {
    return this.app.logger;
  }

  @LifecycleHook()
  public async willReady() {
    const config: ClickHouseConfig = this.app.config.clickhouse;

    if (!config || !config.url) {
      return;
    }

    this.logger.info('[clickhouse] staring clickhouse with url: %s', config.url);
    const clickhouse = this.app.container.get('ARTUSX_CLICKHOUSE') as ClickHouseClient;
    await clickhouse.init(config);
  }
}
