import { Injectable, Inject, ScopeEnum, ArtusInjectEnum } from '@artusx/core';
import { createClient } from '@clickhouse/client';
import type { NodeClickHouseClient } from '@clickhouse/client/dist/client';
import type { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config';

export type ClickHouseConfig = NodeClickHouseClientConfigOptions & {
  prefix?: string;
};

@Injectable({
  id: 'ARTUSX_CLICKHOUSE',
  scope: ScopeEnum.SINGLETON,
})
export default class ClickHouseClient {
  _config: any;

  private clickhouseClient: NodeClickHouseClient;

  constructor(@Inject(ArtusInjectEnum.Config) public config: any) {
    this._config = config || {};
  }

  async init(config: ClickHouseConfig) {
    if (!config.url) {
      return;
    }

    this.clickhouseClient = createClient(config);
  }

  getClient() {
    return this.clickhouseClient;
  }
}

export { ClickHouseClient };
