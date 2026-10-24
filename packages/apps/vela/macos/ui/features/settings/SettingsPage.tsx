import { Clipboard } from 'nsh/clipboard';
import { store } from '../../core/store';
import { Button, Callout, CardContent, CardSection, ListRow, Page, PageHeader, Segmented, Switch } from '../../ui';
import { diagnosticSnapshot, diagnosticSummaryRows } from '../../../../shared/ui/diagnostics';
import { APP_VERSION } from '../../../../shared/ui/version';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

function copyDiagnostics() {
  const status = store.status();
  const protocolVersion = store.protocolVersion();
  Clipboard.writeText(
    status ? diagnosticSnapshot(status, protocolVersion) : JSON.stringify({ version: protocolVersion, redacted: true }),
  );
}

/** Preferences only; sign-in, identity and connection state live on the account page. */
export function SettingsPage() {
  const preferences = () => store.preferences.current();
  const sharingEnabled = () => store.status()?.sharing?.enabled ?? false;
  const diagnostics = () => diagnosticSummaryRows(store.status(), store.protocolVersion());

  return (
    <Page testID="settings-view">
      <PageHeader title="设置" />

      <CardSection title="外观" footer={<Callout>选择立即生效，并在下次启动时恢复。</Callout>}>
        <CardContent>
          <Segmented
            label="界面外观"
            value={preferences().appearance}
            options={APPEARANCE_OPTIONS}
            onChange={(appearance) => store.preferences.update({ appearance })}
          />
        </CardContent>
      </CardSection>

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

      <CardSection
        title="隐私"
        footer={
          <Callout>
            默认关闭。开启后会把账户邮箱的 SHA-256 哈希发送给 Gravatar 以加载头像；邮箱和页面内容不会发送。
          </Callout>
        }
      >
        <ListRow
          title="使用 Gravatar 头像"
          description="无头像、加载失败或账户不是邮箱时显示首字母"
          trailing={
            <Switch
              value={preferences().gravatarAvatar}
              label="使用 Gravatar 头像"
              onChange={(gravatarAvatar) => store.preferences.update({ gravatarAvatar })}
            />
          }
        />
      </CardSection>

      <CardSection
        title="诊断"
        action={<Button testID="copy-diagnostics" title="复制诊断" variant="outline" onPress={copyDiagnostics} />}
        footer={<Callout>不包含认证地址、凭据、Cookie 或业务内容。</Callout>}
      >
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
        <Each of={diagnostics()}>{(row) => <ListRow title={row().title} description={row().detail} />}</Each>
      </CardSection>

      <CardSection
        title="关于"
        footer={<Callout>只读边界：Vela 在前台访问已共享的服务，不改变系统网络或安全设置。</Callout>}
      >
        <ListRow title="版本" description={APP_VERSION} />
        <ListRow title="控制协议" description={`v${store.protocolVersion()}`} />
      </CardSection>
    </Page>
  );
}
