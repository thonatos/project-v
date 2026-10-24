import { View } from 'nsh';
import { Clipboard } from 'nsh/clipboard';
import { store } from '../../core/store';
import {
  Button,
  Callout,
  CardHeader,
  CardSection,
  ListRow,
  Page,
  PageHeader,
  RadioGroup,
  Switch,
  spacing,
} from '../../ui';
import { diagnosticSnapshot, diagnosticSummaryRows } from '../../../../shared/ui/diagnostics';

const PROTOCOL_VERSION = '2';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

function copyDiagnostics() {
  const status = store.status();
  Clipboard.writeText(
    status
      ? diagnosticSnapshot(status, PROTOCOL_VERSION)
      : JSON.stringify({ version: PROTOCOL_VERSION, redacted: true }),
  );
}

/** Preferences only; sign-in, identity and connection state live on the account page. */
export function SettingsPage() {
  const preferences = () => store.preferences.current();
  const sharingEnabled = () => store.status()?.sharing?.enabled ?? false;
  const diagnostics = () => diagnosticSummaryRows(store.status(), PROTOCOL_VERSION);

  return (
    <Page testID="settings-view">
      <PageHeader title="设置" />

      <View class={spacing.sectionGap}>
        <CardHeader title="外观" />
        <RadioGroup
          label="界面外观"
          value={preferences().appearance}
          options={APPEARANCE_OPTIONS}
          onChange={(appearance) => store.preferences.update({ appearance })}
        />
        <Callout>选择立即生效，并在下次启动时恢复。</Callout>
      </View>

      <CardSection title="共享">
        <ListRow
          title="共享这台 Mac"
          description="仅已授权的 Vela 设备可以访问已共享的服务；各服务的共享在设备页单独设置。"
          trailing={
            <Switch
              value={sharingEnabled()}
              label="共享这台 Mac"
              onChange={(enabled) => store.sharing.setEnabled(enabled)}
            />
          }
        />
      </CardSection>

      <CardSection title="通用">
        <ListRow title="关闭窗口" description="Vela 继续在后台运行；退出应用才会停止连接。" />
      </CardSection>

      <CardSection title="调试" footer={<Callout>仅用于排查问题，不改变共享或转发行为。</Callout>}>
        <ListRow
          title="性能 HUD"
          description="显示帧率与渲染开销"
          trailing={
            <Switch
              value={preferences().performanceHud}
              label="性能 HUD"
              onChange={(performanceHud) => store.preferences.update({ performanceHud })}
            />
          }
        />
        <ListRow
          title="详细日志"
          description="记录更多运行细节"
          trailing={
            <Switch
              value={preferences().verboseLogs}
              label="详细日志"
              onChange={(verboseLogs) => store.preferences.update({ verboseLogs })}
            />
          }
        />
      </CardSection>

      <CardSection
        title="诊断"
        action={<Button testID="copy-diagnostics" title="复制诊断" variant="outline" onPress={copyDiagnostics} />}
        footer={<Callout>不包含认证地址、凭据、Cookie 或业务内容。</Callout>}
      >
        <Each of={diagnostics()}>{(row) => <ListRow title={row().title} description={row().detail} />}</Each>
      </CardSection>
    </Page>
  );
}
