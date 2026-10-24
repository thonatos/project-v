/** 我的：登录身份、这台 iPhone 在 Tailnet 中的样子，以及签名状态。 */
import { Input, Text, View } from 'nsh';
import {
  Avatar,
  BarButton,
  Cell,
  Notice,
  PageSheet,
  PrimaryButton,
  Section,
  TabPage,
  font,
  ink,
  inset,
  size,
} from '../../ui';
import { store } from '../../core/store';
import { signingNotice } from '../../core/signing';
import { connectionLabel, deviceAddressLines } from '../../../../shared/ui/devices';

function expiryLabel(): string {
  const value = store.signingExpiry();
  if (!value) return '未嵌入';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MePage() {
  const status = () => store.status();
  const addresses = () => deviceAddressLines(status()?.tailscale?.ips);
  return (
    <TabPage
      title="我的"
      actions={
        <If when={store.signedIn()}>
          <BarButton
            symbol="checkmark.shield"
            label="检查连接"
            disabled={store.rechecking()}
            onPress={store.account.recheck}
          />
        </If>
      }
      testID="me-page"
    >
      <View class={`w-full items-center ${inset.stack} ${inset.sectionTop}`}>
        <Avatar initial={store.userInitial()} signedIn={store.signedIn()} imageUrl={status()?.avatarUrl} large />
        <Text numberOfLines={1} class={`${font.title} ${ink.primary}`}>
          {store.signedIn() ? store.userName() : '未登录'}
        </Text>
      </View>

      <If when={store.authError()}>
        <View class={inset.sectionTop}>
          <Notice tone="danger" title="登录失败" detail={store.authError()} />
        </View>
      </If>
      <If when={store.authPending()}>
        <View class={inset.sectionTop}>
          <Notice
            tone="accent"
            title="正在等待登录"
            detail="在登录页完成授权后，点左上角“完成”回到这里。"
            action={{ label: '检查状态', onPress: store.account.check }}
          />
        </View>
      </If>
      <If when={store.needsAuth() && !store.authPending()}>
        <View class={inset.sectionTop}>
          <PrimaryButton label="登录私人连接" onPress={store.account.signIn} testID="sign-in" />
          <Text class={`${inset.sectionFooter} ${font.detail} ${ink.secondary}`}>在应用内登录，不安装 VPN。</Text>
        </View>
      </If>

      <Section label="私人连接" footer="在 Mac 上，同一账户登录的设备默认可以访问共享服务。">
        <Cell title="状态" value={connectionLabel(store.network())} />
        <Cell title="Tailnet" value={status()?.tailscale?.tailnet ?? '—'} last />
      </Section>

      <If when={store.signedIn()}>
        <Section label="这台 iPhone">
          <Cell
            title="设备名称"
            value={/^iphone$/i.test(status()?.deviceName ?? '') ? '未命名' : (status()?.deviceName ?? '—')}
            onPress={store.account.beginRename}
          />
          <Cell title="MagicDNS" detail={status()?.tailscale?.dnsName || '暂无'} mono />
          <Cell title="地址" detail={addresses().join('\n') || '暂无'} mono last />
        </Section>
        <Section label="开发签名" footer={signingNotice(store.signingExpiry())}>
          <Cell title="到期" value={expiryLabel()} last />
        </Section>
        <Section>
          <Cell title="注销" role="destructive" onPress={store.account.logout} last />
        </Section>
      </If>
    </TabPage>
  );
}

export function RenameSheet() {
  return (
    <PageSheet
      open={store.isOpen('rename')}
      title="设备名称"
      onClose={() => store.navigation.dismiss('rename')}
      cancel={{ label: '取消', onPress: () => store.navigation.dismiss('rename') }}
      confirm={{
        label: '保存',
        onPress: store.account.saveRename,
        disabled: store.rename.busy() || !store.rename.draft().trim(),
      }}
      testID="rename-sheet"
    >
      <Section footer="会同步为这台 iPhone 在 Tailnet 中的名称（MagicDNS），只能用字母、数字和连字符。">
        <View class={`w-full ${size.cell} justify-center ${inset.cell}`}>
          <Input
            value={store.rename.draft()}
            onChange={(value) => {
              store.rename.draft.set(value);
              store.rename.error.set('');
            }}
            onSubmit={store.account.saveRename}
            placeholder={store.userName() ? `${store.userName().split('@')[0]}-iphone` : 'my-iphone'}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            class={`w-full ${size.field} ${font.body} ${ink.primary}`}
          />
        </View>
      </Section>
      <If when={store.rename.error()}>
        <View class={inset.sectionTop}>
          <Notice tone="danger" title="无法保存" detail={store.rename.error()} />
        </View>
      </If>
    </PageSheet>
  );
}
