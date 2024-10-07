import { Inject, Injectable, ArtusXInjectEnum, ArtusApplication } from '@artusx/core';
import ClickHouseClient from '../plugin/clickhouse';

@Injectable()
export default class StrategyService {
  @Inject(ArtusXInjectEnum.Application)
  app: ArtusApplication;

  @Inject('ARTUSX_CLICKHOUSE')
  clickhouseClient: ClickHouseClient;

  get clickhouse() {
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
