/**
 * Forwarded endpoints: how an address is split, and what a client needs to
 * connect to a TCP forward. macOS renders these; iOS opens web forwards in its
 * own WebView and never builds TCP commands.
 */
import { protocolOf } from './services.ts';
import type { ServiceProtocol, ServiceViewModel } from './model.ts';

export interface ForwardEndpoint {
  readonly protocol: ServiceProtocol;
  readonly host: string;
  readonly port: number;
}

/**
 * Splits a forwarded address into what a client needs. TCP forwards have no
 * page to open, so they are shown as a host, a port and a ready command.
 */
export function forwardEndpoint(url: string): ForwardEndpoint {
  try {
    const parsed = new URL(url);
    return { protocol: parsed.protocol === 'tcp:' ? 'tcp' : 'http', host: parsed.hostname, port: Number(parsed.port) };
  } catch {
    return { protocol: 'http', host: '', port: 0 };
  }
}

/**
 * A connection command for a TCP forward. MySQL gets `127.0.0.1` because its
 * client treats `localhost`-style names as a Unix socket; the others keep the
 * per-service host so `~/.ssh/config` entries stay stable.
 */
export function connectionCommand(preset: string | undefined, url: string): string {
  const { protocol, host, port } = forwardEndpoint(url);
  if (protocol !== 'tcp' || !host || !port) return '';
  if (preset === 'ssh') return `ssh -p ${port} <user>@${host}`;
  if (preset === 'mysql') return `mysql -h 127.0.0.1 -P ${port} -u <user> -p`;
  if (preset === 'postgres') return `psql -h ${host} -p ${port} -U <user>`;
  if (preset === 'redis') return `redis-cli -h ${host} -p ${port}`;
  return `${host}:${port}`;
}

export interface ShareWarning {
  readonly title: string;
  readonly message: string;
}

/** First-share confirmation, which is stronger for a shell than for a page. */
export function shareWarning(service: Pick<ServiceViewModel, 'name' | 'protocol' | 'preset'>): ShareWarning {
  const name = service.name || '该服务';
  if (protocolOf(service) === 'tcp' && service.preset === 'ssh') {
    return {
      title: '共享命令行访问',
      message: `${name} 可获得这台 Mac 的命令行。远端设备仍需通过 SSH 自身的密钥或密码认证；请先在“系统设置 › 通用 › 共享”中开启“远程登录”。仅向你信任的私人设备共享。`,
    };
  }
  if (protocolOf(service) === 'tcp') {
    return {
      title: '共享 TCP 服务',
      message: `${name} 会以原始 TCP 方式提供给你的其他设备，认证由该服务自身负责。仅向你信任的私人设备共享。`,
    };
  }
  return {
    title: '共享开发控制权限',
    message: `${name} 可以运行命令并修改这台 Mac 上的文件。仅向你信任的私人设备共享。`,
  };
}
