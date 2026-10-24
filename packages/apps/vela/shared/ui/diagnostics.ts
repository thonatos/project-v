/**
 * Diagnostics: the redacted snapshot users copy, the summary rows both clients
 * show, and the active mappings Core reports.
 */
import type { CoreStatus, DiagnosticActivity } from './protocol.ts';
import { connectionLabel } from './devices.ts';
import { forwardEndpoint } from './forwarding.ts';
import { targetLabel } from './services.ts';

export interface Row {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
}

export function diagnosticSnapshot(status: CoreStatus, protocolVersion: string): string {
  return JSON.stringify({
    version: protocolVersion,
    network: status.network,
    sharing: status.sharing,
    services: (status.services ?? []).map(({ id, state, shared, protocol }) => ({
      id,
      protocol: protocol ?? 'http',
      state,
      shared,
    })),
    remotes: status.remotes.map(({ connection, compatible, issue }) => ({ connection, compatible, issue })),
    redacted: true,
  });
}

/**
 * Projects the redacted snapshot into readable rows, so the settings page can
 * show what would be copied instead of hiding it behind the copy action.
 */
export function diagnosticSummaryRows(status: CoreStatus | null, protocolVersion: string): Row[] {
  if (!status) {
    return [{ key: 'protocol', title: `协议 v${protocolVersion}`, detail: '等待 Core 响应' }];
  }
  const services = status.services ?? [];
  const remotes = status.remotes ?? [];
  const shared = services.filter((service) => service.shared).length;
  const reachable = remotes.filter((remote) => remote.connection === 'connected').length;
  const incompatible = remotes.filter((remote) => remote.compatible === false).length;
  const unavailable = services.filter((service) => service.state !== 'available').length;
  return [
    {
      key: 'protocol',
      title: `协议 v${protocolVersion}`,
      detail: status.tailscale?.tailnet ? `tailnet ${status.tailscale.tailnet}` : '未连接 tailnet',
    },
    { key: 'network', title: '私人连接', detail: connectionLabel(status.network) },
    {
      key: 'sharing',
      title: '共享',
      detail: status.sharing?.enabled
        ? `已开启 · ${shared}/${services.length} 个服务已共享${unavailable > 0 ? ` · ${unavailable} 个不可用` : ''}`
        : '已关闭',
    },
    {
      key: 'remotes',
      title: '其他设备',
      detail:
        remotes.length === 0
          ? '尚未添加'
          : `${reachable}/${remotes.length} 台在线${incompatible > 0 ? ` · ${incompatible} 台需要更新` : ''}`,
    },
  ];
}

export function diagnosticActivityRows(activity: DiagnosticActivity | null): Row[] {
  return (activity?.mappings ?? []).map((mapping) => ({
    key: `${mapping.privateName}/${mapping.service}`,
    title: `${mapping.device} / ${mapping.service}`,
    detail: `${targetLabel(forwardEndpoint(mapping.url).protocol, mapping.url)} · ${mapping.connections} 个活跃连接`,
  }));
}

export function appearancePreference(status: CoreStatus | null): 'system' | 'light' | 'dark' {
  const appearance = status?.preferences?.appearance;
  return appearance === 'light' || appearance === 'dark' ? appearance : 'system';
}

export function remoteAddError(detail: string): string {
  if (detail.includes('incompatible')) return '两台 Mac 的 Vela 版本不兼容。';
  if (detail.includes('authorized') || detail.includes('rejected')) return '另一台设备拒绝了访问。';
  if (detail.includes('invalid')) return '私人名称格式无效。';
  return '无法连接到这台 Mac。请确认它在线并运行 Vela。';
}
