import { View } from "nsh";
import { Modal } from "nsh/ui/mobile";
import { store } from "../../core/store";
import { Button, Callout, Card, FormSheet, List, ListEmpty, Page, PageHeader, TextField } from "../../ui";
import { ForwardRow, forwardService } from "./ForwardRow";

export function ForwardsPage() {
  const browse = () => <Button title="查看设备" variant="outline" onPress={store.navigate.devices} />;
  return <Page testID="forwards-view">
    <PageHeader title="转发" description="每条转发都有固定的本机地址，可在浏览器或客户端中使用。" actions={browse()} />
    <Card>
      <List
        count={store.forwards().length}
        empty={<ListEmpty title="尚未转发任何服务" description="在设备详情中开始转发，Vela 会为它分配固定的本机地址。" action={browse()} />}
      >
        <Each of={store.forwards()}>{(item) => <ForwardRow device={item().device} service={forwardService(item())} caption={item().device.name} />}</Each>
      </List>
    </Card>
    <Callout>地址按「设备 + 服务」固定，重启 Vela 后保持不变，书签和 ~/.ssh/config 条目长期有效。</Callout>
  </Page>;
}

export function DSHAuthSheet() {
  const close = store.forwarding.cancelDSH;
  return <Modal
    visible={Boolean(store.dsh.target())}
    dismissible
    onRequestClose={close}
    desktop={{ presentationStyle: "formSheet" }}
    style={{ width: 420, height: 340 }}
  >
    <FormSheet
      title="DSH Web 认证"
      description="认证地址可选。Vela 只在本次转发中使用它，不会保存地址或 token。"
      actions={<>
        <Button title="取消" variant="plain" onPress={close} />
        <Button title="直接转发" variant="outline" onPress={() => store.forwarding.startDSH(false)} />
        <Button title="使用认证地址" disabled={!store.dsh.url().trim()} onPress={() => store.forwarding.startDSH(true)} />
      </>}
    >
      <TextField
        label="DSH Web 地址（可选）"
        mono
        value={store.dsh.url()}
        onChange={(value) => store.dsh.url.set(value)}
        onSubmit={() => store.forwarding.startDSH(true)}
        placeholder="例如 http://127.0.0.1:3080/…"
        hint="运行 dsh web 后粘贴它输出的地址。"
        error={store.dsh.error()}
      />
    </FormSheet>
  </Modal>;
}
