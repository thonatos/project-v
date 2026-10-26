/** The Logs tab: the recent redacted journal, filtered by level. */
import { Text, View } from 'nsh';
import { BarButton, Cell, Notice, Section, Segmented, TabPage, font, ink, inset, line } from '../../ui';
import { store } from '../../core/store';
import { logLevelCounts, logRows } from '../../../../shared/ui/logs';

const LEVELS = ['all', 'error', 'warn', 'info'] as const;
const LABELS = { all: '全部', error: '错误', warn: '警告', info: '信息' } as const;

export function LogsPage() {
  const counts = () => logLevelCounts(store.diagnostics());
  const rows = () => logRows(store.diagnostics(), store.logLevel()).slice(0, 200);
  const selected = () => Math.max(0, LEVELS.indexOf(store.logLevel()));
  return (
    <TabPage
      title="日志"
      actions={
        <>
          <BarButton
            symbol={store.copied() === 'logs' ? 'checkmark' : 'doc.on.doc'}
            label="复制日志"
            disabled={rows().length === 0}
            onPress={store.diagnosticsActions.copyLogs}
          />
          <BarButton symbol="arrow.clockwise" label="刷新" onPress={store.diagnosticsActions.refresh} />
        </>
      }
      onRefresh={store.diagnosticsActions.refresh}
      testID="logs-page"
    >
      <View class={`w-full ${inset.sectionTop}`}>
        <Segmented
          items={LEVELS.map((level) => `${LABELS[level]} ${counts()[level]}`)}
          selected={selected()}
          onChange={(index) => store.logsView.selectLevel(LEVELS[index] ?? 'all')}
        />
      </View>

      <Section>
        <If when={rows().length > 0} else={<Cell title={counts().all === 0 ? '暂无日志' : '该级别没有记录'} last />}>
          <Each of={rows()} key={(row) => row.key}>
            {(row, index) => (
              <View class={`w-full ${inset.cell}`}>
                <View class={`w-full ${inset.tight} ${inset.cellY} ${index() < rows().length - 1 ? line.bottom : ''}`}>
                  <View class={`flex-row items-center ${inset.stack}`}>
                    <Text class={`${font.mono} ${ink.tertiary}`}>{row().time}</Text>
                    <Text
                      class={`${font.microStrong} ${row().level === 'error' ? ink.danger : row().level === 'warn' ? ink.warning : ink.secondary}`}
                    >
                      {row().levelLabel}
                    </Text>
                    <Text numberOfLines={1} class={`min-w-0 flex-1 ${font.micro} ${ink.secondary}`}>
                      {row().area}
                    </Text>
                  </View>
                  <Text class={`${font.detail} ${ink.primary}`}>{row().message}</Text>
                </View>
              </View>
            )}
          </Each>
        </If>
      </Section>
      <Text class={`${inset.sectionFooter} ${font.detail} ${ink.secondary}`}>
        只保留最近的事件，不包含 Cookie、token 或页面内容。
      </Text>
      <If when={store.copyError()}>
        <View class={inset.sectionTop}>
          <Notice tone="danger" title="复制失败" detail={store.copyError()} />
        </View>
      </If>
    </TabPage>
  );
}
