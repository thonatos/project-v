import { View } from "nsh";
import { store } from "../../core/store";
import { Alert, Badge, Button, Callout, CardSection, ListRow, Page, PageHeader, spacing } from "../../ui";
import { connectionLabel, deviceAddressLines } from "../../../ui-shared/view-model.mjs";

/** Identity only: sign-in, who this Mac is signed in as, and how it appears on the tailnet. */
export function AccountPage() {
  const tailscale = () => store.status()?.tailscale;
  const connected = () => store.network() === "connected";
  const deviceName = () => store.status()?.deviceName || tailscale()?.name || "未命名";
  const addresses = () => {
    const lines = deviceAddressLines(tailscale()?.ips);
    return lines.length > 0 ? lines : ["暂无地址"];
  };

  return <Page testID="account-view">
    <PageHeader title="账户" description="登录状态与这台 Mac 在 tailnet 中的身份。" />

    <If when={store.needsAuth()}>
      <View class={spacing.sectionGap}>
        <Alert
          testID="onboarding"
          tone="warning"
          title="需要登录 Tailscale"
          description="Vela 在应用内建立私人连接，不会更改系统 VPN、代理、DNS 或路由。"
          action={store.authPending()
            ? <Button title="重新检查" variant="outline" onPress={() => store.account.check()} />
            : <Button title="重新登录" variant="primary" onPress={() => store.account.signIn()} />}
        />
        <If when={store.authPending()}><Callout>请在浏览器中完成登录，然后回到这里。</Callout></If>
      </View>
    </If>
    <If when={store.authError()}>
      <Alert tone="danger" description={store.authError()} />
    </If>

    <CardSection title="私人连接" footer={<Callout>由 Tailscale 提供，不创建系统 VPN，也不更改代理、DNS 或路由。</Callout>}>
      <ListRow title="状态" badge={<Badge status={store.network()}>{connectionLabel(store.network())}</Badge>} />
      <ListRow title="账户" description={tailscale()?.user ?? "未登录"} />
      <ListRow title="Tailnet" description={tailscale()?.tailnet ?? "未连接"} />
    </CardSection>

    <CardSection title="这台 Mac 的身份" footer={<Callout>名称会同步到当前 Tailscale 节点。</Callout>}>
      <ListRow
        title="设备名称"
        description={deviceName()}
        trailing={<Button title="修改名称" variant="outline" onPress={() => store.account.beginRename()} />}
      />
      <ListRow title="MagicDNS" mono description={tailscale()?.dnsName || "暂无名称"} />
      <ListRow title="地址" mono description={addresses()} />
    </CardSection>

    <CardSection title="登录">
      <ListRow
        title={connected() ? "重新检查连接" : "重新连接"}
        description={connected() ? "立即向 Tailscale 确认当前身份。" : "重新建立私人连接。"}
        trailing={<Button
          title={store.rechecking() ? "正在检查…" : connected() ? "重新检查" : "重新连接"}
          variant="outline"
          disabled={store.rechecking()}
          onPress={() => store.account.reconnect()}
        />}
      />
      <ListRow
        title="注销"
        description="移除这台 Mac 上保存的身份，共享与转发会停止。"
        trailing={<Button title="注销" variant="danger" onPress={() => store.account.logout()} />}
      />
    </CardSection>
  </Page>;
}
