import { store } from "../../core/store";
import { Button, Callout, Card, List, ListEmpty, Page, PageHeader } from "../../ui";
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
