import { View } from 'nsh';
import { store } from '../../core/store';
import {
  Alert,
  Button,
  Callout,
  CardHeader,
  CardSection,
  ListRow,
  Page,
  PageHeader,
  Segmented,
  spacing,
  Switch,
} from '../../ui';
import { diagnosticSummaryRows } from '../../../../shared/ui/diagnostics';
import { APP_VERSION } from '../../../../shared/ui/version';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

/** Preferences only; sign-in, identity and connection state live on the account page. */
export function SettingsPage() {
  const preferences = () => store.preferences.current();
  const sharingEnabled = () => store.status()?.sharing?.enabled ?? false;
  const diagnostics = () => diagnosticSummaryRows(store.status(), store.protocolVersion());

  return (
    <Page testID="settings-view">
      <PageHeader title="设置" />

      <View class={spacing.sectionGap}>
        <CardHeader title="外观" />
        <Segmented
          label="界面外观"
          value={preferences().appearance}
          options={APPEARANCE_OPTIONS}
          onChange={(appearance) => store.preferences.update({ appearance })}
        />
        <Callout>选择立即生效，并在下次启动时恢复。</Callout>
      </View>

      <CardSection
        title="连接与共享"
        footer={<Callout>共享仅对已授权的 Vela 设备开放。代理设置重启 Vela 后生效，且只影响 Tailscale。</Callout>}
      >
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
        <ListRow
          title="Tailscale 使用代理"
          description="使用启动 Vela 时继承的 HTTP/HTTPS 代理"
          trailing={
            <Switch
              value={preferences().tailscaleProxy}
              label="Tailscale 使用代理"
              onChange={(tailscaleProxy) => store.preferences.update({ tailscaleProxy })}
            />
          }
        />
      </CardSection>

      <CardSection
        title="隐私与诊断"
        action={
          <Button
            testID="copy-diagnostics"
            title="复制诊断"
            variant="outline"
            onPress={store.diagnosticsActions.copy}
          />
        }
        footer={<Callout>Gravatar 仅接收邮箱的 SHA-256 哈希。诊断不包含认证地址、凭据、Cookie 或业务内容。</Callout>}
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
      <If when={store.copyError()}>
        <Alert tone="danger" title="复制失败" description={store.copyError()} />
      </If>

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
