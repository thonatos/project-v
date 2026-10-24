/**
 * The devices pane: the device list, this Mac's sharing detail, and a remote
 * device's services and forwards.
 */
import { View } from 'nsh';
import { Menu } from 'nsh/desktop';
import { store } from '../../core/store';
import { ForwardRow } from '../forwards/ForwardRow';
import type { ConnectionState, DeviceViewModel, ServiceViewModel } from '../../../../shared/ui/model';
import {
  Alert,
  Badge,
  Button,
  Callout,
  CardSection,
  Dot,
  IconTile,
  List,
  ListEmpty,
  ListRow,
  Page,
  PageHeader,
  spacing,
  Switch,
} from '../../ui';
import { connectionLabel, deviceAddressLines } from '../../../../shared/ui/devices';
import { diagnosticActivityRows } from '../../../../shared/ui/diagnostics';
import { serviceStateLabel } from '../../../../shared/ui/services';

const localName = () => store.status()?.deviceName ?? store.status()?.tailscale.name ?? '当前设备';
const localSummary = () => `${store.services().length} 个本地服务`;
const localAddresses = () => deviceAddressLines(store.status()?.tailscale.ips);

/** The connection mark, matching the iOS device rows. */
const connectionTone = (connection: ConnectionState) =>
  connection === 'connected'
    ? 'success'
    : connection === 'connecting' || connection === 'needs-auth'
      ? 'warning'
      : 'offline';

export function DevicesPage() {
  return (
    <Page testID="devices-view">
      <If when={store.selected() === ''}>
        <DeviceList />
      </If>
      <If when={store.selected() === 'this-mac'}>
        <LocalDetail />
      </If>
      <If when={store.selected() !== '' && store.selected() !== 'this-mac' ? store.selectedDevice() : undefined}>
        <RemoteDetail device={store.selectedDevice()!} />
      </If>
    </Page>
  );
}

function NeedsAuthAlert() {
  return (
    <If when={store.needsAuth()}>
      <Alert
        tone="warning"
        title="尚未连接 Tailscale"
        description="登录 Tailscale 后，其他设备才能发现并访问这台 Mac。"
        action={<Button title="前往账户" variant="outline" onPress={store.navigate.account} />}
      />
    </If>
  );
}

function DeviceList() {
  const localLines = () => `${connectionLabel(store.network())} · ${store.services().length} 个服务`;
  return (
    <>
      <PageHeader title="设备" />
      <NeedsAuthAlert />
      <CardSection title="这台 Mac">
        <ListRow
          testID="device-this-mac"
          title={localName()}
          leading={<IconTile symbol="desktopcomputer" />}
          description={localLines()}
          trailing={<Dot tone={connectionTone(store.network())} />}
          onPress={() => store.navigate.select('this-mac')}
        />
      </CardSection>
      <CardSection
        title={`其他设备（${store.devices().length}）`}
        action={<Button title="添加设备" symbol="plus" variant="outline" onPress={store.remotes.beginAdd} />}
      >
        <List
          count={store.devices().length}
          empty={
            <ListEmpty
              title="还没有添加其他设备"
              description="添加同一 Tailnet 中运行 Vela 的另一台设备，即可使用它共享的服务。"
              action={<Button title="添加设备" onPress={store.remotes.beginAdd} />}
            />
          }
        >
          <Each of={store.devices()} key={(device) => device.id}>
            {(device) => <RemoteDeviceRow device={device()} />}
          </Each>
        </List>
      </CardSection>
    </>
  );
}

function RemoteDeviceRow(props: { device: DeviceViewModel }) {
  const lines = () => `${connectionLabel(props.device.connection)} · ${props.device.services.length} 个服务`;
  return (
    <ListRow
      testID={`device-${props.device.id}`}
      title={props.device.name}
      leading={<IconTile symbol="desktopcomputer" />}
      description={lines()}
      trailing={<Dot tone={connectionTone(props.device.connection)} />}
      onPress={() => store.navigate.select(props.device.id)}
    />
  );
}

function LocalDetail() {
  return (
    <>
      <PageHeader
        title={localName()}
        back={{ label: '设备', onPress: store.navigate.devices }}
        description={localSummary()}
      />
      <NeedsAuthAlert />
      <CardSection title="设备信息">
        <ListRow title="MagicDNS 名称" description={store.status()?.tailscale.dnsName ?? '暂无'} mono />
        <ListRow title="地址" description={localAddresses().length > 0 ? localAddresses() : ['暂无地址']} mono />
      </CardSection>
      <CardSection title="共享">
        <ListRow
          title="共享这台 Mac"
          description="仅已授权的 Vela 设备可以访问已共享的服务"
          trailing={
            <Switch
              value={store.status()?.sharing?.enabled ?? false}
              label="共享这台 Mac"
              onChange={store.sharing.setEnabled}
            />
          }
        />
      </CardSection>
      <CardSection
        title="本地服务"
        action={<Button title="添加服务" symbol="plus" variant="outline" onPress={() => store.serviceEditor.begin()} />}
        footer={
          <View class={`flex-row items-center ${spacing.inline}`}>
            <View class="min-w-0 flex-1">
              <Callout>只接受 localhost、127.0.0.1 或 ::1 上的服务</Callout>
            </View>
            <Button testID="refresh-services" title="重新检查" variant="plain" onPress={() => void store.load()} />
          </View>
        }
      >
        <List
          count={store.services().length}
          empty={
            <ListEmpty
              title="尚未添加本地服务"
              action={<Button title="添加服务" onPress={() => store.serviceEditor.begin()} />}
            />
          }
        >
          <Each of={store.services()} key={(service) => service.id}>
            {(service) => <LocalServiceRow service={service()} />}
          </Each>
        </List>
      </CardSection>
    </>
  );
}

function LocalServiceRow(props: { service: ServiceViewModel }) {
  const protocolName = () => (props.service.protocol === 'tcp' ? 'TCP' : 'Web');
  const locked = () => props.service.state !== 'available' && !props.service.shared;
  const manage = () =>
    void Menu.popup([
      { label: '编辑服务…', onSelect: () => store.serviceEditor.begin(props.service) },
      { type: 'separator' },
      { label: '删除服务', onSelect: () => store.serviceEditor.remove(props.service) },
    ]);
  return (
    <ListRow
      title={props.service.name}
      badge={<Badge status={props.service.state}>{serviceStateLabel(props.service)}</Badge>}
      description={`${protocolName()} · ${props.service.subtitle}`}
      mono
      trailing={
        <>
          <Switch
            value={props.service.shared}
            disabled={locked()}
            label={`共享 ${props.service.name}`}
            onChange={(value) => store.sharing.setServiceShared(props.service, value)}
          />
          <Button title="更多操作" symbol="ellipsis" iconOnly variant="plain" onPress={manage} />
        </>
      }
    />
  );
}

function RemoteDetail(props: { device: DeviceViewModel }) {
  const addresses = () => deviceAddressLines(props.device.ips);
  const activity = () =>
    diagnosticActivityRows(store.activity()).filter((row) => row.key.startsWith(`${props.device.privateName}/`));
  const unauthorized = () => props.device.issue === 'unauthorized';
  const connecting = () => props.device.connection === 'connecting';
  const problemTitle = () =>
    connecting()
      ? `正在连接 ${props.device.name}`
      : unauthorized()
        ? '这台 Mac 拒绝了连接'
        : `${props.device.name} 处于离线状态`;
  const problemDetail = () =>
    connecting()
      ? '正在检查私人连接和可用服务。'
      : unauthorized()
        ? '请在另一台设备上确认当前设备有权访问。'
        : `上次连接：${props.device.lastConnected}。设备恢复后 Vela 会继续连接。`;
  return (
    <>
      <PageHeader
        title={props.device.name}
        back={{ label: '设备', onPress: store.navigate.devices }}
        description={props.device.privateName}
        actions={<Button title="删除设备" variant="danger" onPress={() => store.remotes.remove(props.device)} />}
      />
      <CardSection title="设备信息">
        <ListRow
          title="状态"
          badge={<Badge status={props.device.connection}>{connectionLabel(props.device.connection)}</Badge>}
        />
        <ListRow title="私人名称" description={props.device.privateName} mono />
        <ListRow title="兼容性" description={props.device.compatible ? 'Vela 协议兼容' : '需要更新 Vela'} />
        <ListRow title="上次连接" description={props.device.lastConnected} />
        <ListRow title="地址" description={addresses().length > 0 ? addresses() : ['暂无地址']} mono />
      </CardSection>
      <If
        when={props.device.compatible}
        else={
          <Alert
            tone="danger"
            title="需要更新 Vela"
            description={`${props.device.name} 使用的连接版本与当前应用不兼容。请更新两台 Mac 上的 Vela。`}
            action={<Button title="重新检查" variant="outline" onPress={store.remotes.retry} />}
          />
        }
      >
        <If
          when={props.device.connection === 'connected'}
          else={
            <Alert
              tone="warning"
              title={problemTitle()}
              description={problemDetail()}
              action={
                connecting() ? undefined : <Button title="再次尝试" variant="outline" onPress={store.remotes.retry} />
              }
            />
          }
        >
          <CardSection
            title="可用服务"
            footer={<Callout>转发地址按「设备 + 服务」固定，重启 Vela 后保持不变。</Callout>}
          >
            <List count={props.device.services.length} empty={<ListEmpty title="这台设备没有共享服务" />}>
              <Each of={props.device.services} key={(service) => service.id}>
                {(service) => <ForwardRow device={props.device} service={service()} />}
              </Each>
            </List>
          </CardSection>
        </If>
      </If>
      <CardSection title="连接活动">
        <List count={activity().length} empty={<ListEmpty title="当前没有到这台设备的活跃连接" />}>
          <Each of={activity()} key={(row) => row.key}>
            {(row) => <ListRow title={row().title} description={row().detail} mono />}
          </Each>
        </List>
      </CardSection>
    </>
  );
}
