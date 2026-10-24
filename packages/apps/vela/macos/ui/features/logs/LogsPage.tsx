import { Clipboard } from 'nsh/clipboard';
import { store } from '../../core/store';
import { Button, Callout, Card, ListEmpty, LogList, Page, PageHeader, Segmented } from '../../ui';
import { logLevelCounts, logRows, type LogLevel } from '../../../../shared/ui/logs';

const FILTERS: readonly { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' },
];

export function LogsPage() {
  const counts = () => logLevelCounts(store.logs());
  const rows = () => logRows(store.logs(), store.logLevel()).slice(0, 300);
  const emptyAction = () =>
    counts().all === 0 ? undefined : (
      <Button title="显示全部" variant="outline" onPress={() => store.logLevel.set('all')} />
    );

  function copyLogs() {
    const lines = rows();
    if (lines.length === 0) return;
    Clipboard.writeText(lines.map((row) => `${row.time} ${row.levelLabel} ${row.area} ${row.message}`).join('\n'));
  }

  return (
    <Page testID="logs-view">
      <PageHeader
        title="运行日志"
        actions={
          <>
            <Button title="复制日志" variant="outline" disabled={rows().length === 0} onPress={copyLogs} />
            <Button title="刷新" variant="outline" onPress={store.refreshDiagnostics} />
          </>
        }
      />
      <Segmented
        label="日志级别"
        value={store.logLevel()}
        options={FILTERS.map((filter) => ({ value: filter.value, label: `${filter.label} ${counts()[filter.value]}` }))}
        onChange={(level) => store.logLevel.set(level)}
      />
      <Card>
        <If
          when={rows().length > 0}
          else={<ListEmpty title={counts().all === 0 ? '暂无日志' : '该级别没有记录'} action={emptyAction()} />}
        >
          <LogList lines={rows()} testID="log-list" />
        </If>
      </Card>
      <Callout>只保留最近的事件，不包含认证地址、token、Cookie 或页面内容。</Callout>
    </Page>
  );
}
