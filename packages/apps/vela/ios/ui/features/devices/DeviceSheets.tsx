/** Devices: the saved Macs, one Mac's details, and adding a Mac from the tailnet. */
import { Input, Text, View } from 'nsh';
import {
  BarButton,
  Cell,
  Chip,
  Dot,
  EmptyState,
  IconTile,
  Notice,
  PageSheet,
  PrimaryButton,
  Section,
  Symbol,
  TabPage,
  font,
  ink,
  inset,
  size,
  symbol,
} from '../../ui';
import { store } from '../../core/store';
import type { DeviceViewModel } from '../../../../shared/ui/model';
import type { TailnetDevice } from '../../../../shared/ui/protocol';
import { connectionLabel, deviceAddressLines, serviceKindLabel } from '../../../../shared/ui/devices';
import { diagnosticActivityRows } from '../../../../shared/ui/diagnostics';

const deviceTone = (device: DeviceViewModel) =>
  device.connection === 'connected'
    ? 'success'
    : device.connection === 'connecting' || device.connection === 'needs-auth'
      ? 'warning'
      : 'offline';

/** The Devices tab: this iPhone, then every saved Mac. */
export function DevicesPage() {
  const status = () => store.status();
  return (
    <TabPage
      title="设备"
      actions={
        <>
          <BarButton
            symbol="arrow.clockwise"
            label="刷新"
            disabled={store.refreshing()}
            onPress={store.remotes.refresh}
          />
          <BarButton symbol="plus" label="添加设备" onPress={store.navigation.add} />
        </>
      }
      refreshing={store.refreshing()}
      onRefresh={store.remotes.refresh}
      testID="devices-page"
    >
      <Section label="这台 iPhone" footer={store.signedIn() ? '点按可修改它在 Tailnet 中的名称。' : undefined}>
        <Cell
          title={status()?.deviceName ?? 'iPhone'}
          detail={store.signedIn() ? (deviceAddressLines(status()?.tailscale?.ips)[0] ?? '已连接') : '未登录'}
          leading={<IconTile name="iphone" />}
          trailing={
            <Chip
              tone={store.network() === 'connected' ? 'success' : store.network() === 'offline' ? 'offline' : 'warning'}
              label={connectionLabel(store.network())}
            />
          }
          onPress={store.signedIn() ? store.account.beginRename : store.navigation.account}
          last
        />
      </Section>

      <If
        when={store.devices().length > 0}
        else={
          <EmptyState
            symbol="desktopcomputer"
            title="还没有添加其他设备"
            detail="从 Tailnet 中选择运行 Vela 的设备。"
            action={<PrimaryButton label="添加设备" onPress={store.navigation.add} />}
          />
        }
      >
        <Section label="其他设备" footer="移除只影响这台 iPhone，不会改变 Mac 上的 Vela。">
          <Each of={store.devices()} key={(device) => device.id}>
            {(device, index) => (
              <Cell
                title={device().name}
                detail={`${connectionLabel(device().connection)} · ${device().services.length} 个服务`}
                leading={<IconTile name="desktopcomputer" />}
                trailing={<Dot tone={deviceTone(device())} />}
                onPress={() => store.navigation.device(device().id)}
                last={index() === store.devices().length - 1}
              />
            )}
          </Each>
        </Section>
      </If>
    </TabPage>
  );
}

export function DeviceSheet() {
  const device = () => store.device();
  const addresses = () => deviceAddressLines(device()?.ips);
  const activity = () =>
    diagnosticActivityRows(store.activity()).filter((row) => row.key.startsWith(`${device()?.privateName ?? ''}/`));
  const issue = () => {
    const value = device();
    if (!value) return null;
    if (!value.compatible)
      return { title: '需要更新 Vela', detail: '这台 Mac 的 Vela 版本与当前应用不兼容，请更新后重试。' };
    if (value.issue === 'unauthorized')
      return { title: '这台 Mac 拒绝了访问', detail: '确认两台设备登录同一账户，或在 Mac 上允许这台 iPhone。' };
    if (value.connection !== 'connected')
      return { title: 'Mac 当前离线', detail: `上次连接：${value.lastConnected}。确认它未休眠且 Vela 正在运行。` };
    return null;
  };
  return (
    <PageSheet
      open={store.isOpen('device')}
      title={device()?.name ?? '设备'}
      onClose={() => store.navigation.dismiss('device')}
      actions={
        <BarButton
          symbol="arrow.clockwise"
          label="刷新服务"
          disabled={store.refreshing()}
          onPress={store.remotes.refresh}
        />
      }
      testID="device-sheet"
    >
      <If when={device()} else={<EmptyState symbol="questionmark.circle" title="设备已移除" />}>
        <If when={issue()}>
          <View class={inset.sectionTop}>
            <Notice
              tone={device()?.compatible === false || device()?.issue === 'unauthorized' ? 'danger' : 'offline'}
              title={issue()?.title ?? ''}
              detail={issue()?.detail}
              action={{ label: '重新检查', onPress: store.remotes.refresh }}
            />
          </View>
        </If>

        <Section label="服务">
          <If when={(device()?.services.length ?? 0) > 0} else={<Cell title="没有共享服务" last />}>
            <Each of={device()?.services ?? []} key={(service) => service.id}>
              {(service, index) => (
                <Cell
                  title={service().name}
                  detail={serviceKindLabel(service())}
                  onPress={
                    service().protocol === 'tcp'
                      ? undefined
                      : () => {
                          const value = device();
                          if (value) store.navigation.open(value, service());
                        }
                  }
                  trailing={service().protocol === 'tcp' ? <Chip tone="offline" label="仅 Mac" /> : undefined}
                  last={index() === (device()?.services.length ?? 0) - 1}
                />
              )}
            </Each>
          </If>
        </Section>

        <Section label="信息">
          <Cell
            title="状态"
            trailing={
              <Chip
                tone={device() ? deviceTone(device()!) : 'offline'}
                label={connectionLabel(device()?.connection ?? 'offline')}
              />
            }
          />
          <Cell title="私人名称" detail={device()?.privateName} mono />
          <Cell title="地址" detail={addresses().join('\n') || '暂无'} mono />
          <Cell title="协议" value={device()?.compatible ? '兼容' : '需要更新'} />
          <Cell title="上次连接" value={device()?.lastConnected} last />
        </Section>

        <Section label="连接活动" footer="这台 iPhone 当前打开到这台 Mac 的本地映射。">
          <If when={activity().length > 0} else={<Cell title="没有活动连接" last />}>
            <Each of={activity()} key={(row) => row.key}>
              {(row, index) => (
                <Cell title={row().title} detail={row().detail} mono last={index() === activity().length - 1} />
              )}
            </Each>
          </If>
        </Section>

        <Section>
          <Cell
            title="移除这台 Mac"
            role="destructive"
            onPress={() => {
              const value = device();
              if (value) store.remotes.remove(value);
            }}
            last
          />
        </Section>
      </If>
    </PageSheet>
  );
}

function CandidateCell(props: { device: TailnetDevice; last: boolean }) {
  const name = () => props.device.dnsName ?? '';
  const added = () => Boolean(name()) && store.devices().some((item) => item.privateName === name());
  const selected = () => store.addDevice.selection() === name() && !added();
  const trailing = () => {
    if (added()) return <Text class={`${font.detail} ${ink.tertiary}`}>已添加</Text>;
    if (selected()) return <Symbol name="checkmark" size={symbol.accessory} weight="semibold" color="accent" />;
    return undefined;
  };
  return (
    <Cell
      title={props.device.name || name()}
      detail={name() || '没有 MagicDNS 名称'}
      mono={Boolean(name())}
      leading={<Dot tone={props.device.online ? 'success' : 'offline'} />}
      trailing={trailing() ?? <View class={size.symbolSpacer} />}
      onPress={added() || !name() ? undefined : () => store.remotes.choose(name())}
      disabled={added() || !name()}
      last={props.last}
    />
  );
}

export function AddDeviceSheet() {
  const busy = () => store.addDevice.busy();
  const canSubmit = () => !busy() && Boolean(store.addDevice.name().trim() || store.addDevice.selection());
  const candidates = () => store.tailnetCandidates();
  return (
    <PageSheet
      open={store.isOpen('add')}
      title="添加设备"
      onClose={() => store.navigation.dismiss('add')}
      cancel={{ label: '取消', onPress: () => store.navigation.dismiss('add') }}
      confirm={{ label: busy() ? '验证中' : '添加', onPress: store.remotes.submitAdd, disabled: !canSubmit() }}
      testID="add-device-sheet"
    >
      <If when={store.needsAuth()}>
        <View class={inset.sectionTop}>
          <Notice
            tone="warning"
            title="尚未连接"
            detail="登录后才能发现设备；也可以直接输入私人名称。"
            action={{ label: '登录', onPress: store.navigation.account }}
          />
        </View>
      </If>

      <Section label="Tailnet 中的设备" footer="只有运行 Vela 并开启“共享这台 Mac”的设备能通过验证。">
        <If
          when={candidates().length > 0}
          else={<Cell title={store.addDevice.loading() ? '正在查找设备…' : '没有发现设备'} last />}
        >
          <Each of={candidates()} key={(device) => device.dnsName ?? device.name}>
            {(device, index) => <CandidateCell device={device()} last={index() === candidates().length - 1} />}
          </Each>
        </If>
      </Section>

      <Section label="或输入私人名称">
        <View class={`w-full ${size.cell} justify-center ${inset.cell}`}>
          <Input
            value={store.addDevice.name()}
            onChange={store.remotes.setAddName}
            onSubmit={store.remotes.submitAdd}
            placeholder="studio.example.ts.net"
            autoCapitalize="none"
            autoCorrect={false}
            class={`w-full ${size.field} ${font.mono} ${ink.primary}`}
          />
        </View>
      </Section>

      <If when={store.addDevice.error()}>
        <View class={inset.sectionTop}>
          <Notice tone="danger" title="无法添加" detail={store.addDevice.error()} />
        </View>
      </If>
    </PageSheet>
  );
}
