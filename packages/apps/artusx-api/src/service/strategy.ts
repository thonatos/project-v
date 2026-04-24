import { type ArtusApplication, ArtusXInjectEnum, Inject, Injectable } from '@artusx/core';
import type PluginClickHouse from '@artusx/plugin-clickhouse/client';
import type { ClickHouseClient } from '@artusx/plugin-clickhouse/types';
import { PluginInjectEnum } from '@artusx/utils';

@Injectable()
export default class StrategyService {
  @Inject(ArtusXInjectEnum.Application)
  app: ArtusApplication;

  @Inject(PluginInjectEnum.ClickHouse)
  clickhouseClient: PluginClickHouse;

  get clickhouse(): ClickHouseClient {
    return this.clickhouseClient.getClient();
  }

  async listStrategy() {
    const result = await this.clickhouse.query({
      query: 'SELECT * FROM strategies LIMIT 50',
    });

    const dataset = await result.json();

    return dataset.data;
  }
}
