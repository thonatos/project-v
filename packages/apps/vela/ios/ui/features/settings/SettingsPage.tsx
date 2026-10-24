/** Settings: appearance, logging and the app's boundaries. */
import { View } from 'nsh';
import { Cell, IconTile, Section, Segmented, TabPage, Toggle, inset, size } from '../../ui';
import { store } from '../../core/store';
import { APP_VERSION } from '../../../../shared/ui/version';

const APPEARANCES = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

export function SettingsPage() {
  const preferences = () => store.preferences.current();
  const selected = () =>
    Math.max(
      0,
      APPEARANCES.findIndex((item) => item.value === preferences().appearance),
    );
  return (
    <TabPage title="设置" testID="settings-page">
      <Section label="外观">
        <View class={`w-full ${size.cell} justify-center ${inset.cell}`}>
          <Segmented
            items={APPEARANCES.map((item) => item.label)}
            selected={selected()}
            onChange={(index) => store.preferences.update({ appearance: APPEARANCES[index]?.value ?? 'system' })}
          />
        </View>
      </Section>

      <Section
        label="隐私"
        footer="默认关闭。开启后会把账户邮箱的 SHA-256 哈希发送给 Gravatar 以加载头像；邮箱和页面内容不会发送。"
      >
        <Cell
          title="使用 Gravatar 头像"
          detail="无头像、加载失败或账户不是邮箱时显示首字母"
          leading={<IconTile name="person.crop.circle" />}
          trailing={
            <Toggle
              value={preferences().gravatarAvatar}
              label="使用 Gravatar 头像"
              onChange={(gravatarAvatar) => store.preferences.update({ gravatarAvatar })}
            />
          }
          last
        />
      </Section>

      <Section label="诊断" footer="详细日志记录更多连接细节，仍不包含 Cookie、token 或页面内容。">
        <Cell
          title="详细日志"
          leading={<IconTile name="text.alignleft" />}
          trailing={
            <Toggle
              value={preferences().verboseLogs}
              label="详细日志"
              onChange={(verboseLogs) => store.preferences.update({ verboseLogs })}
            />
          }
        />
        <Cell
          title="复制诊断信息"
          detail={store.copied() === 'diagnostics' ? '已复制到剪贴板' : '版本、连接状态与脱敏后的错误'}
          leading={<IconTile name="doc.on.doc" />}
          onPress={store.diagnosticsActions.copy}
          last
        />
      </Section>

      <Section
        label="关于"
        footer="Vela 只在前台访问远端 Mac 已共享的服务：不共享这台 iPhone，不安装 VPN，不改变系统网络。"
      >
        <Cell title="版本" value={APP_VERSION} leading={<IconTile name="app.badge" />} />
        <Cell
          title="控制协议"
          value={`v${store.protocolVersion()}`}
          leading={<IconTile name="point.3.connected.trianglepath.dotted" />}
          last
        />
      </Section>
    </TabPage>
  );
}
