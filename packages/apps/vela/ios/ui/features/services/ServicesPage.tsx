/**
 * Home: every shared service, grouped by the Mac that shares it. This is the
 * browser's start page — one tap opens a service.
 */
import { Text, View } from 'nsh';
import { Button } from 'nsh/base';
import {
  BarButton,
  Cell,
  Chip,
  Dot,
  EmptyState,
  Monogram,
  Notice,
  PrimaryButton,
  Symbol,
  TabPage,
  Wordmark,
  font,
  ink,
  inset,
  radius,
  state,
  surface,
  symbol,
} from '../../ui';
import { store } from '../../core/store';
import type { DeviceViewModel, ServiceViewModel } from '../../../../shared/ui/model';
import { connectionLabel, serviceBadge, serviceKindLabel } from '../../../../shared/ui/devices';

const deviceTone = (device: DeviceViewModel) =>
  device.connection === 'connected'
    ? 'success'
    : device.connection === 'connecting' || device.connection === 'needs-auth'
      ? 'warning'
      : 'offline';

/** The page that stays loaded under the list: tap to return to it. */
function ResumeCard() {
  const current = () => store.currentService();
  return (
    <If when={current() && store.stage().phase !== 'empty'}>
      <View class={inset.sectionTop}>
        <Button
          onPress={store.navigation.resume}
          role="button"
          accessibilityLabel={`返回 ${current()?.service.name ?? ''}`}
          class={`w-full flex-row items-center ${inset.row} ${inset.resume} ${radius.cell} ${surface.accentSoft} ${state.press}`}
        >
          <Monogram label={current()?.service.name ?? ''} colorKey={current()?.device.privateName ?? ''} />
          <View class={`min-w-0 flex-1 ${inset.tight}`}>
            <Text class={`${font.microStrong} ${ink.accent}`}>正在浏览</Text>
            <Text numberOfLines={1} class={`${font.bodyStrong} ${ink.primary}`}>
              {current()?.service.name ?? ''}
            </Text>
            <Text numberOfLines={1} class={`${font.detail} ${ink.secondary}`}>
              {current()?.device.name ?? ''}
            </Text>
          </View>
          <Symbol name="arrow.up.forward.app" size={symbol.accessory} weight="medium" color="accent" />
        </Button>
      </View>
    </If>
  );
}

function ServiceCell(props: { device: DeviceViewModel; service: ServiceViewModel; last: boolean }) {
  const badge = () => serviceBadge(props.device, props.service);
  const recent = () => store.isRecent({ device: props.device, service: props.service });
  const trailing = () => {
    if (badge().disabled) return <Chip tone="offline" label="仅 Mac" />;
    if (badge().status === 'available') return undefined;
    const t = badge().status === 'unavailable' ? 'danger' : badge().status === 'offline' ? 'offline' : 'warning';
    return <Chip tone={t} label={badge().label} />;
  };
  return (
    <Cell
      title={props.service.name}
      detail={serviceKindLabel(props.service, recent())}
      leading={
        <Monogram
          label={props.service.name}
          colorKey={props.device.privateName}
          muted={badge().disabled || props.device.connection !== 'connected'}
        />
      }
      trailing={trailing()}
      onPress={badge().disabled ? undefined : () => store.navigation.open(props.device, props.service)}
      last={props.last}
      tall
      testID={`service-${props.device.id}-${props.service.id}`}
    />
  );
}

function DeviceSection(props: { device: DeviceViewModel; services: ServiceViewModel[] }) {
  return (
    <View class={`w-full ${inset.sectionTop}`}>
      <Button
        onPress={() => store.navigation.device(props.device.id)}
        role="button"
        accessibilityLabel={`${props.device.name}，${connectionLabel(props.device.connection)}`}
        class={`w-full flex-row items-center ${inset.stack} ${inset.sectionLabel} ${state.press}`}
      >
        <Dot tone={deviceTone(props.device)} />
        <Text numberOfLines={1} class={`min-w-0 flex-1 ${font.sectionLabel} ${ink.secondary}`}>
          {props.device.name}
        </Text>
        <Text class={`${font.detail} ${ink.tertiary}`}>{connectionLabel(props.device.connection)}</Text>
        <Symbol name="info.circle" size={symbol.body} color="tertiary" />
      </Button>
      <View class={`w-full overflow-hidden ${radius.cell} ${surface.cell}`}>
        <If
          when={props.services.length > 0}
          else={<Cell title="没有共享服务" detail="在这台 Mac 上开启共享后刷新" last />}
        >
          <Each of={props.services} key={(service) => service.id}>
            {(service, index) => (
              <ServiceCell device={props.device} service={service()} last={index() === props.services.length - 1} />
            )}
          </Each>
        </If>
      </View>
    </View>
  );
}

export function ServicesPage() {
  const groups = () => store.deviceGroups();
  return (
    <TabPage
      title="服务"
      brand={<Wordmark />}
      actions={
        <BarButton
          symbol="arrow.clockwise"
          label="刷新服务"
          disabled={store.refreshing()}
          onPress={store.remotes.refresh}
        />
      }
      refreshing={store.refreshing()}
      onRefresh={store.remotes.refresh}
      testID="services-page"
    >
      <If when={store.needsAuth()}>
        <View class={inset.sectionTop}>
          <Notice
            tone="warning"
            title="尚未连接"
            detail="登录后才能看到 Mac 共享的服务。"
            action={{ label: '登录', onPress: () => store.navigation.select('me') }}
          />
        </View>
      </If>

      <ResumeCard />

      <If when={(store.loading() || store.network() === 'connecting') && groups().length === 0}>
        <EmptyState symbol="antenna.radiowaves.left.and.right" title="正在连接" detail="读取设备与共享服务…" />
      </If>

      <If when={!store.loading() && store.network() !== 'connecting' && groups().length === 0}>
        <EmptyState
          symbol="desktopcomputer"
          title="还没有添加其他设备"
          detail="添加同一 Tailnet 中运行 Vela 的设备，它共享的服务会出现在这里。"
          action={<PrimaryButton label="添加设备" onPress={store.navigation.add} />}
        />
      </If>

      <Each of={groups()} key={(group) => group.device.id}>
        {(group) => <DeviceSection device={group().device} services={group().services} />}
      </Each>
    </TabPage>
  );
}
