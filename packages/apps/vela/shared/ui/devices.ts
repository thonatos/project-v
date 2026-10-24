/**
 * Device and service view models: what a list row needs, independent of the
 * platform that renders it.
 */
import type { CoreLocalService, CoreRemote } from './protocol.ts';
import type { ConnectionState, DeviceViewModel, ServiceViewModel } from './model.ts';
import { protocolOf, targetLabel } from './services.ts';

export function localServices(status: { readonly services?: readonly CoreLocalService[] }): ServiceViewModel[] {
  return (status.services ?? []).map((service) => {
    const protocol = protocolOf(service);
    return {
      id: service.id,
      name: service.name,
      subtitle: targetLabel(protocol, service.url),
      protocol,
      preset: service.preset,
      state: service.state,
      shared: service.shared,
      url: service.url,
      port: service.port,
      adapter: service.adapter,
      authLog: service.authLog,
      authLink: service.authLink,
    };
  });
}

export function remoteDevices(remotes: readonly CoreRemote[]): DeviceViewModel[] {
  return remotes.map((remote) => ({
    id: remote.privateName,
    name: remote.name || remote.privateName,
    privateName: remote.privateName,
    ips: [...(remote.ips ?? [])],
    connection: remote.connection ?? 'offline',
    lastConnected: remote.lastConnectedUtc ?? '从未连接',
    compatible: remote.compatible ?? true,
    issue: remote.issue,
    services: (remote.services ?? []).map((service) => {
      const protocol = protocolOf(service);
      return {
        id: service.id,
        name: service.name,
        subtitle: protocol === 'tcp' ? 'TCP 服务' : service.adapter === 'dsh' ? 'DSH Web' : 'Web 服务',
        protocol,
        preset: service.preset,
        state: service.available ? 'available' : 'unavailable',
        shared: true,
        port: service.port,
        adapter: service.adapter,
      } satisfies ServiceViewModel;
    }),
  }));
}

/** Keyboard selection order across this Mac and the saved remotes. */
export function nextDeviceID(selected: string, remoteIDs: readonly string[], direction: -1 | 1): string {
  const ids = ['this-mac', ...remoteIDs];
  const current = ids.indexOf(selected);
  const next = current < 0 ? 0 : (current + direction + ids.length) % ids.length;
  return ids[next];
}

/** A device row's addresses: IPv4 first, each family on its own line. */
export function deviceAddressLines(ips: readonly string[] | undefined): string[] {
  const list = [...(ips ?? [])];
  const v4 = list.filter((ip) => !ip.includes(':'));
  const v6 = list.filter((ip) => ip.includes(':'));
  return [...v4, ...v6];
}

const CONNECTION_LABELS: Readonly<Record<string, string>> = {
  connected: '在线',
  connecting: '连接中',
  offline: '离线',
  'needs-auth': '需要连接',
};

export function connectionLabel(state: ConnectionState): string {
  return CONNECTION_LABELS[state] ?? '离线';
}

export function isRecentService(
  last: { readonly device: string; readonly service: string } | null,
  device: Pick<DeviceViewModel, 'privateName'>,
  service: Pick<ServiceViewModel, 'id'>,
): boolean {
  return Boolean(last && last.device === device.privateName && last.service === service.id);
}

/** A service's kind, with the recent marker appended when it applies. */
export function serviceKindLabel(service: Pick<ServiceViewModel, 'protocol' | 'adapter'>, recent = false): string {
  if (protocolOf(service) === 'tcp') return 'TCP 服务 · 没有 iOS 入口';
  const kind = service.adapter === 'dsh' ? 'DSH Web' : 'Web 服务';
  return recent ? `${kind} · 最近访问` : kind;
}

export interface ServiceBadgeView {
  readonly status: ConnectionState | ServiceViewModel['state'] | 'unavailable';
  readonly label: string;
  readonly disabled: boolean;
}

/**
 * One status vocabulary for service rows: protocol first, then the device's
 * connection, then the service's own availability.
 */
export function serviceBadge(
  device: Pick<DeviceViewModel, 'connection'>,
  service: Pick<ServiceViewModel, 'protocol' | 'state'>,
): ServiceBadgeView {
  if (protocolOf(service) === 'tcp') return { status: 'unavailable', label: 'iOS 不支持', disabled: true };
  if (device.connection !== 'connected')
    return { status: device.connection, label: connectionLabel(device.connection), disabled: false };
  if (service.state === 'available') return { status: 'available', label: '可用', disabled: false };
  if (service.state === 'checking') return { status: 'checking', label: '检查中', disabled: false };
  return { status: 'unavailable', label: '不可用', disabled: false };
}

/**
 * Groups services under their devices: online devices first, then by name;
 * inside a device the last visited service comes first, then by name.
 */
export function groupServicesByDevice(
  devices: readonly DeviceViewModel[],
  last: { readonly device: string; readonly service: string } | null = null,
): { readonly device: DeviceViewModel; readonly services: ServiceViewModel[] }[] {
  return devices
    .map((device) => ({
      device,
      services: [...device.services].sort(
        (left, right) =>
          Number(isRecentService(last, device, right)) - Number(isRecentService(last, device, left)) ||
          left.name.localeCompare(right.name),
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.device.connection === 'connected') - Number(left.device.connection === 'connected') ||
        left.device.name.localeCompare(right.device.name),
    );
}
