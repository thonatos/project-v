import { View } from 'nsh';
import { store } from '../../core/store';
import { Button, Callout, Card, ListEmpty, LogList, Page, PageHeader, spacing } from '../../ui';
import { logLevelCounts, logRows, type LogLevel } from '../../../../shared/ui/logs';

const filters: readonly { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' },
];

export function LogsPage() {
  const counts = () => logLevelCounts(store.logs());
  const rows = () => logRows(store.logs(), store.logLevel()).slice(0, 300);
  const filteredOut = () => store.logLevel() !== 'all' && counts().all > 0;
  return (
    <Page testID="logs-view">
      <PageHeader
        title="运行日志"
        actions={<Button title="刷新" variant="outline" onPress={store.refreshDiagnostics} />}
      />
      <View class={`flex-row flex-wrap items-center ${spacing.inline}`}>
        <Each of={filters}>
          {(filter) => (
            <Button
              title={`${filter().label} ${counts()[filter().value]}`}
              variant={store.logLevel() === filter().value ? 'primary' : 'outline'}
              onPress={() => store.logLevel.set(filter().value)}
            />
          )}
        </Each>
      </View>
      <Card>
        <If
          when={rows().length > 0}
          else={
            <If when={filteredOut()} else={<ListEmpty title="暂无记录" />}>
              <ListEmpty
                title="没有该等级的记录"
                action={<Button title="显示全部" variant="outline" onPress={() => store.logLevel.set('all')} />}
              />
            </If>
          }
        >
          <LogList lines={rows()} testID="log-list" />
        </If>
      </Card>
      <Callout>只保留最近的事件，不包含认证地址、token、Cookie 或页面内容。</Callout>
    </Page>
  );
}
