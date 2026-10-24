/**
 * Service presets, target normalisation and form validation.
 *
 * `targetKey` and `serviceFormError` mirror Core's duplicate-target and target
 * validation rules; `shared/protocol/fixtures` pins the two implementations to
 * the same cases.
 */
import type { ServiceProtocol, ServiceViewModel } from './model.ts';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

export function protocolOf(service: { readonly protocol?: string } | null | undefined): ServiceProtocol {
  return service?.protocol === 'tcp' ? 'tcp' : 'http';
}

/** `tcp://127.0.0.1:6379` reads as `127.0.0.1:6379`; HTTP targets stay as URLs. */
export function targetLabel(protocol: ServiceProtocol, url: string | undefined): string {
  if (protocol !== 'tcp') return url ?? '';
  return String(url ?? '').replace(/^tcp:\/\//, '');
}

/**
 * The loopback host and port a service dials, mirroring Core's duplicate
 * rule: `localhost` folds into `127.0.0.1`, and a missing port is 80.
 */
export function targetKey(protocol: ServiceProtocol, raw: string | undefined): string {
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;
    const port = parsed.port || (protocol === 'tcp' ? '' : '80');
    return port ? `${host}:${port}` : host;
  } catch {
    return '';
  }
}

export type PresetGroup = 'web' | 'tcp';
export type PresetValue =
  | 'opencode'
  | 'dsh'
  | 'comfyui'
  | 'custom-http'
  | 'ssh'
  | 'redis'
  | 'mysql'
  | 'postgres'
  | 'custom-tcp';

export interface ServicePreset {
  readonly preset: PresetValue;
  readonly group: PresetGroup;
  readonly label: string;
  readonly protocol: ServiceProtocol;
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly adapter: string;
  readonly unique: boolean;
}

export interface PresetOption {
  readonly value: PresetValue;
  readonly label: string;
  readonly detail: string;
  readonly disabled: boolean;
}

/**
 * Presets for the add-service form, grouped by protocol. `id` is the stable
 * service identifier Core keeps for OpenCode and DSH; other presets let Core
 * assign one, so the same preset can be added more than once.
 */
export const SERVICE_PRESETS: readonly ServicePreset[] = [
  {
    preset: 'opencode',
    group: 'web',
    label: 'OpenCode',
    protocol: 'http',
    id: 'opencode',
    name: 'OpenCode',
    url: 'http://127.0.0.1:49374/api/info',
    adapter: 'opencode',
    unique: true,
  },
  {
    preset: 'dsh',
    group: 'web',
    label: 'DSH',
    protocol: 'http',
    id: 'dsh',
    name: 'DSH',
    url: 'http://127.0.0.1:3080/',
    adapter: 'dsh',
    unique: true,
  },
  {
    preset: 'comfyui',
    group: 'web',
    label: 'ComfyUI',
    protocol: 'http',
    id: '',
    name: 'ComfyUI',
    url: 'http://127.0.0.1:8188/',
    adapter: '',
    unique: false,
  },
  {
    preset: 'custom-http',
    group: 'web',
    label: '自定义 HTTP',
    protocol: 'http',
    id: '',
    name: '',
    url: 'http://127.0.0.1:',
    adapter: '',
    unique: false,
  },
  {
    preset: 'ssh',
    group: 'tcp',
    label: 'SSH',
    protocol: 'tcp',
    id: '',
    name: 'SSH',
    url: 'tcp://127.0.0.1:22',
    adapter: '',
    unique: false,
  },
  {
    preset: 'redis',
    group: 'tcp',
    label: 'Redis',
    protocol: 'tcp',
    id: '',
    name: 'Redis',
    url: 'tcp://127.0.0.1:6379',
    adapter: '',
    unique: false,
  },
  {
    preset: 'mysql',
    group: 'tcp',
    label: 'MySQL',
    protocol: 'tcp',
    id: '',
    name: 'MySQL',
    url: 'tcp://127.0.0.1:3306',
    adapter: '',
    unique: false,
  },
  {
    preset: 'postgres',
    group: 'tcp',
    label: 'PostgreSQL',
    protocol: 'tcp',
    id: '',
    name: 'PostgreSQL',
    url: 'tcp://127.0.0.1:5432',
    adapter: '',
    unique: false,
  },
  {
    preset: 'custom-tcp',
    group: 'tcp',
    label: '自定义 TCP',
    protocol: 'tcp',
    id: '',
    name: '',
    url: 'tcp://127.0.0.1:',
    adapter: '',
    unique: false,
  },
];

/** Options for one preset group, with a unique preset disabled once it exists. */
export function presetOptions(group: PresetGroup, services: readonly ServiceViewModel[]): PresetOption[] {
  return SERVICE_PRESETS.filter((preset) => preset.group === group).map((preset) => {
    const key = targetKey(preset.protocol, preset.url);
    const exists = services.some(
      (service) =>
        service.adapter === preset.adapter ||
        (preset.id !== '' && service.id === preset.id) ||
        (key !== '' && targetKey(protocolOf(service), service.url) === key),
    );
    return {
      value: preset.preset,
      label: preset.label,
      detail: targetLabel(preset.protocol, preset.url.replace(/:$/, ':…')),
      disabled: Boolean(preset.unique && exists),
    };
  });
}

export function presetFor(value: string): ServicePreset {
  const preset =
    SERVICE_PRESETS.find((item) => item.preset === value) ??
    SERVICE_PRESETS.find((item) => item.preset === 'custom-http');
  if (!preset) throw new Error('SERVICE_PRESETS must define custom-http');
  return preset;
}

/** The preset a stored service most likely came from, so editing shows its type. */
export function presetForService(service: ServiceViewModel | undefined): PresetValue {
  const stored = service?.preset;
  if (stored && SERVICE_PRESETS.some((preset) => preset.preset === stored)) return stored as PresetValue;
  if (service?.adapter === 'opencode') return 'opencode';
  if (service?.adapter === 'dsh') return 'dsh';
  const key = targetKey(protocolOf(service), service?.url);
  const byTarget = SERVICE_PRESETS.find((preset) => preset.unique && targetKey(preset.protocol, preset.url) === key);
  if (byTarget) return byTarget.preset;
  return protocolOf(service) === 'tcp' ? 'custom-tcp' : 'custom-http';
}

/**
 * Validates the form before it reaches Core, so the message names the field the
 * user can fix. Core still validates authoritatively.
 */
export function serviceFormError(protocol: ServiceProtocol, name: string, target: string): string {
  if (!name.trim()) return '请输入服务名称。';
  const value = target.trim();
  if (protocol === 'tcp') {
    const match = value.replace(/^tcp:\/\//, '').match(/^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/);
    if (!match) return '请输入 loopback 地址与端口，例如 127.0.0.1:6379。';
    const port = Number(match[2]);
    if (port < 1 || port > 65535) return '端口必须在 1–65535 之间。';
    return '';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return '请输入完整的 loopback HTTP 地址，例如 http://127.0.0.1:3000/。';
  }
  if (parsed.protocol !== 'http:' || !LOOPBACK_HOSTS.includes(parsed.hostname))
    return '只接受 localhost、127.0.0.1 或 ::1 的 HTTP 地址。';
  return '';
}

/** Normalises the TCP field to the `tcp://host:port` form Core expects. */
export function serviceTargetURL(protocol: ServiceProtocol, target: string): string {
  const value = target.trim();
  if (protocol !== 'tcp') return value;
  return value.startsWith('tcp://') ? value : `tcp://${value}`;
}

/** The label for a service's availability; sharing itself is a switch. */
export function serviceStateLabel(service: Pick<ServiceViewModel, 'state' | 'protocol'>): string {
  if (service.state === 'checking') return '检查中';
  if (service.state === 'unavailable') return protocolOf(service) === 'tcp' ? '未在监听' : '不可用';
  return '可用';
}

/** Where `dsh --profile web` launched by launchd usually writes its output. */
export const DSH_AUTH_LOG_PLACEHOLDER = '~/.dsh/logs/web.stdout.log';

const DSH_AUTH_LINK_LABELS: Readonly<Record<string, string>> = {
  ready: '已获取登录链接，其他设备转发时会自动登录。',
  missing: '日志里还没有 dsh web 的启动地址。确认 DSH 正在运行，且输出写入这个文件。',
  unreadable: '无法读取这个文件。请检查路径和权限。',
};

/**
 * The editor hint for DSH's sign-in log: what the field is for when empty,
 * otherwise the state Core last read from it.
 */
export function dshAuthLogHint(authLog: string | undefined, authLink: string | undefined): string {
  if (!String(authLog ?? '').trim())
    return '可选。填写 DSH 输出日志的路径，Vela 会读取其中的登录链接，其他设备转发时自动登录，无需知道 token。';
  return (authLink !== undefined ? DSH_AUTH_LINK_LABELS[authLink] : undefined) ?? '保存后 Vela 会读取其中的登录链接。';
}
