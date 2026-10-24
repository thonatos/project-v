/**
 * Application state and the flows that change it. Features read signals and
 * call actions here; only this module and `client.ts` know Core exists.
 */
import { cleanup, effect, signal } from 'nsh';
import { setColorScheme } from 'nsh/device';
import { Clipboard } from 'nsh/clipboard';
import { AlertDialog } from 'nsh/base';
import type { DeviceViewModel, ServiceProtocol, ServiceViewModel } from '../../../shared/ui/model';
import type { LinkPhase } from '../ui';
import { localServices, nextDeviceID, remoteDevices } from '../../../shared/ui/devices';
import { appearancePreference } from '../../../shared/ui/diagnostics';
import { shareWarning } from '../../../shared/ui/forwarding';
import { createAuthFlows } from '../../../shared/ui/flows/auth';
import { createPreferencesFlow } from '../../../shared/ui/flows/preferences';
import { createRemoteFlows } from '../../../shared/ui/flows/remotes';
import { createRenameFlow } from '../../../shared/ui/flows/rename';
import {
  signedIn as identitySignedIn,
  userInitial as identityInitial,
  userLabel as identityLabel,
} from '../../../shared/ui/identity';
import type { LogLevel } from '../../../shared/ui/logs';
import {
  presetFor,
  presetForService,
  serviceFormError,
  serviceTargetURL,
  type PresetValue,
} from '../../../shared/ui/services';
import type { CoreStatus, DiagnosticActivity, DiagnosticLogs, Preferences } from '../../../shared/ui/protocol';
import { core, CoreError } from './client';

export type Pane = 'devices' | 'forwards' | 'logs' | 'account' | 'settings';

/** One remote service Vela forwards to a stable loopback address. */
export interface Forward {
  readonly device: DeviceViewModel;
  readonly service: string;
  readonly phase: LinkPhase;
  readonly url?: string;
  readonly message?: string;
}

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

/**
 * Keeps the previous object for every item whose content did not change.
 * Rows read their item inside prop getters, so a new object for an unchanged
 * service makes its row build its native controls again; every status poll
 * would then recreate every switch on the page, not only the one that changed.
 */
function keepUnchanged<T extends { id: string }>(previous: readonly T[], next: T[]): T[] {
  const byID = new Map(previous.map((item) => [item.id, item]));
  return next.map((item) => {
    const old = byID.get(item.id);
    return old && JSON.stringify(old) === JSON.stringify(item) ? old : item;
  });
}

/** Asks for confirmation with a destructive action; resolves true when chosen. */
function confirmDestructive(title: string, description: string, confirmLabel: string): Promise<boolean> {
  return AlertDialog.show({
    title,
    description,
    actions: [
      { label: '取消', role: 'cancel', id: 'cancel' },
      { label: confirmLabel, role: 'destructive', id: 'confirm' },
    ],
  }).then((choice) => choice === 'confirm');
}

function createStore() {
  // Navigation
  const pane = signal<Pane>('devices');
  const selected = signal('');

  // Core snapshot
  const status = signal<CoreStatus | null>(null);
  const network = signal<DeviceViewModel['connection']>('needs-auth');
  const services = signal<ServiceViewModel[]>([]);
  const devices = signal<DeviceViewModel[]>([]);
  const logs = signal<DiagnosticLogs | null>(null);
  const activity = signal<DiagnosticActivity | null>(null);
  const forwards = signal<Forward[]>([]);

  // Sign-in
  const authPending = signal(false);
  const authError = signal('');
  const rechecking = signal(false);

  // Add device
  const addDevice = {
    open: signal(false),
    name: signal(''),
    selection: signal(''),
    busy: signal(false),
    loading: signal(false),
    error: signal(''),
  };
  // Rename this Mac
  const rename = { open: signal(false), draft: signal(''), error: signal('') };
  // Add or edit a local service
  const editor = {
    open: signal(false),
    editing: signal(''),
    preset: signal<PresetValue>('custom-http'),
    id: signal(''),
    name: signal(''),
    target: signal(''),
    protocol: signal<ServiceProtocol>('http'),
    adapter: signal(''),
    authLog: signal(''),
    error: signal(''),
  };

  // Logs page
  const logLevel = signal<LogLevel | 'all'>('all');

  let pending: Promise<CoreStatus | null> | null = null;
  let timer: number | undefined;

  const needsAuth = () => network() === 'needs-auth';
  const protocolVersion = () => String(core.protocolVersion());
  const signedIn = () => identitySignedIn(status());
  const userName = () => identityLabel(status());
  const userInitial = () => identityInitial(status());
  const selectedDevice = () => devices().find((device) => device.id === selected());
  const forwardKey = (device: DeviceViewModel, service: string) => `${device.id}/${service}`;
  const forwardFor = (device: DeviceViewModel, service: string) =>
    forwards().find((item) => forwardKey(item.device, item.service) === forwardKey(device, service));
  const tailnetCandidates = () =>
    [...(status()?.tailnetDevices ?? [])].sort(
      (left, right) => Number(right.online) - Number(left.online) || left.name.localeCompare(right.name),
    );
  const selectableTailnetNames = () =>
    tailnetCandidates()
      .map((device) => device.dnsName ?? '')
      .filter((name) => name && !devices().some((device) => device.privateName === name));

  async function refreshRemotes() {
    const current = devices();
    if (current.length === 0) return;
    devices.set(current.map((device) => ({ ...device, connection: 'connecting' })));
    try {
      devices.set(keepUnchanged(devices(), remoteDevices(await core.refreshRemotes())));
    } catch (error) {
      devices.set(current.map((device) => ({ ...device, connection: 'offline', issue: 'offline' })));
      console.error('VELA_STATE remote-refresh-failed', reason(error));
    }
  }

  function load(refreshRemoteDevices = false): Promise<CoreStatus | null> {
    if (pending) return pending;
    pending = (async () => {
      try {
        const next = await core.status();
        status.set(next);
        network.set(next.network);
        // A completed login or a revoked identity ends the previous browser
        // login attempt. In particular, a re-check that discovers removal
        // must reveal the sign-in action instead of leaving "re-check" stuck.
        if (next.network === 'connected' || next.network === 'needs-auth') {
          authPending.set(false);
        }
        services.set(keepUnchanged(services(), localServices(next)));
        devices.set(keepUnchanged(devices(), remoteDevices(next.remotes)));
        setColorScheme(appearancePreference(next));
        core.setPerformanceHud(next.preferences?.performanceHud ?? false);
        if (
          refreshRemoteDevices &&
          next.network === 'connected' &&
          next.remotes.some((remote) => remote.connection !== 'connecting')
        )
          void refreshRemotes();
        return next;
      } catch (error) {
        network.set('offline');
        console.error('VELA_STATE status-load-failed', reason(error));
        return null;
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  async function poll() {
    const before = network();
    const next = await load(false);
    if (next?.network === 'connected' && before !== 'connected') void refreshRemotes();
    const delay = next?.network === 'connected' ? 10_000 : next?.network === 'needs-auth' ? 5_000 : 1_000;
    timer = setTimeout(() => void poll(), delay);
  }

  function refreshDiagnostics() {
    core
      .activity()
      .then((value) => activity.set(value))
      .catch((error) => console.error('VELA_STATE diagnostics-activity-failed', reason(error)));
    core
      .logs()
      .then((value) => logs.set(value))
      .catch((error) => console.error('VELA_STATE diagnostics-logs-failed', reason(error)));
  }

  /** Starts polling, plus diagnostics while a page that shows them is open. */
  function start() {
    void poll();
    cleanup(() => clearTimeout(timer));
    effect(() => {
      if (pane() !== 'logs' && !(pane() === 'devices' && selected() && selected() !== 'this-mac')) return;
      refreshDiagnostics();
      const interval = setInterval(refreshDiagnostics, 5_000);
      cleanup(() => clearInterval(interval));
    });
  }

  const navigate = {
    devices: () => {
      selected.set('');
      pane.set('devices');
    },
    forwards: () => pane.set('forwards'),
    logs: () => {
      pane.set('logs');
      refreshDiagnostics();
    },
    account: () => pane.set('account'),
    settings: () => pane.set('settings'),
    select(id: string) {
      selected.set(id);
      pane.set('devices');
      if (id !== 'this-mac') void refreshRemotes();
    },
    back() {
      if (pane() === 'devices' && selected()) navigate.devices();
    },
    moveSelection(direction: -1 | 1) {
      if (pane() !== 'devices') return;
      selected.set(
        nextDeviceID(
          selected(),
          devices().map((device) => device.id),
          direction,
        ),
      );
    },
  };

  // Shared flows: identity, rename, saved devices and preferences. Platform
  // wording and the steps after each action stay here.
  const auth = createAuthFlows({
    core,
    openExternal: core.openExternal,
    pending: authPending,
    error: authError,
    rechecking,
    load: (refresh) => load(refresh),
    isConnected: () => network() === 'connected',
    confirmLogout: () =>
      confirmDestructive('注销这台 Mac？', '将移除这台 Mac 上保存的身份，共享与转发会停止。', '注销'),
    messages: {
      startFailed: '无法开始私人连接。请检查网络后重试。',
      notConnected: '尚未连接。完成浏览器认证后再次检查。',
      reconnectFailed: '无法完成检查，请稍后重试。',
      recheckFailed: '无法完成检查，请稍后重试。',
    },
    tag: 'VELA_STATE',
  });

  const renameFlow = createRenameFlow({
    core,
    status,
    draft: rename.draft,
    error: rename.error,
    initial: () => status()?.deviceName ?? '',
    open: () => rename.open.set(true),
    close: () => rename.open.set(false),
    afterSave: () => setTimeout(() => void load(), 1_000),
    messages: {
      empty: '请输入设备名称。',
      invalid: '只能使用字母、数字和连字符，且以字母或数字开头，最多 63 个字符。',
    },
  });

  const remoteFlows = createRemoteFlows({
    core,
    addDevice,
    load: () => load(),
    afterAdd: () => addDevice.open.set(false),
    confirmRemove: (device) =>
      confirmDestructive(
        `移除 ${device.name}？`,
        '只会删除这台 Mac 上保存的设备，不会影响另一台设备上的 Vela。',
        '移除',
      ),
    afterConfirmed: (device) => {
      for (const item of forwards().filter((forward) => forward.device.id === device.id)) forwarding.stop(item);
      if (selected() === device.id) navigate.devices();
    },
    messages: { chooseDevice: '请选择一台设备，或输入完整私人名称。' },
    tag: 'VELA_STATE',
  });

  const preferencesFlow = createPreferencesFlow({
    core,
    status,
    apply: (next) => {
      setColorScheme(next.appearance);
      core.setPerformanceHud(next.performanceHud);
    },
    onSaved: () => void load(),
    tag: 'VELA_STATE',
  });

  const account = {
    signIn: auth.signIn,
    check: auth.check,
    reconnect: () => auth.reconnect(),
    logout: auth.logout,
    beginRename: renameFlow.begin,
    saveRename: renameFlow.save,
  };

  const sharing = {
    setEnabled(enabled: boolean) {
      const current = status();
      if (current)
        status.set({
          ...current,
          sharing: { enabled, opencode: current.sharing?.opencode ?? false, dsh: current.sharing?.dsh ?? false },
        });
      core
        .updateSharing({ enabled, opencode: current?.sharing?.opencode ?? false, dsh: current?.sharing?.dsh ?? false })
        .catch((error) => {
          console.error('VELA_STATE sharing-update-failed', reason(error));
          void load();
        });
    },
    setServiceShared(service: ServiceViewModel, shared: boolean) {
      const commit = () => {
        services.set(services().map((item) => (item.id === service.id ? { ...item, shared } : item)));
        core
          .upsertService({
            id: service.id,
            name: service.name,
            url: service.url ?? '',
            adapter: service.adapter ?? '',
            protocol: service.protocol,
            preset: service.preset ?? '',
            shared,
          })
          .then(() => load())
          .catch((error) => {
            console.error('VELA_STATE service-update-failed', reason(error));
            void load();
          });
      };
      if (!shared) {
        commit();
        return;
      }
      // The switch keeps showing "off" until the user confirms.
      const warning = shareWarning(service);
      void confirmDestructive(warning.title, warning.message, '确认共享').then((confirmed) => {
        if (confirmed) commit();
      });
    },
  };

  const serviceEditor = {
    applyPreset(value: PresetValue) {
      const preset = presetFor(value);
      editor.preset.set(preset.preset);
      editor.id.set(preset.id);
      editor.name.set(preset.name);
      editor.target.set(preset.protocol === 'tcp' ? preset.url.replace(/^tcp:\/\//, '') : preset.url);
      editor.protocol.set(preset.protocol);
      editor.adapter.set(preset.adapter);
      editor.authLog.set('');
      editor.error.set('');
    },
    begin(service?: ServiceViewModel) {
      if (service) {
        editor.editing.set(service.id);
        editor.preset.set(presetForService(service));
        editor.id.set(service.id);
        editor.name.set(service.name);
        editor.target.set(service.protocol === 'tcp' ? service.subtitle : (service.url ?? ''));
        editor.protocol.set(service.protocol);
        editor.adapter.set(service.adapter ?? '');
        editor.authLog.set(service.authLog ?? '');
        editor.error.set('');
      } else {
        editor.editing.set('');
        serviceEditor.applyPreset('custom-http');
      }
      editor.open.set(true);
    },
    save() {
      const protocol = editor.protocol();
      const problem = serviceFormError(protocol, editor.name(), editor.target());
      if (problem) {
        editor.error.set(problem);
        return;
      }
      const existing = services().find((service) => service.id === editor.id());
      const adapter = protocol === 'tcp' ? '' : editor.adapter();
      core
        .upsertService({
          id: editor.id(),
          name: editor.name().trim(),
          url: serviceTargetURL(protocol, editor.target()),
          adapter,
          protocol,
          preset: editor.preset().startsWith('custom-') ? '' : editor.preset(),
          shared: existing?.shared ?? false,
          authLog: adapter === 'dsh' ? editor.authLog().trim() : '',
        })
        .then(() => {
          editor.open.set(false);
          return load();
        })
        .catch((error) => editor.error.set(reason(error)));
    },
    remove(service: ServiceViewModel) {
      void confirmDestructive(
        `删除 ${service.name}？`,
        '将停止该服务的共享入口，但不会停止本地服务进程。',
        '删除',
      ).then((confirmed) => {
        if (confirmed)
          core
            .removeService(service.id)
            .then(() => load())
            .catch((error) => console.error('VELA_STATE service-remove-failed', reason(error)));
      });
    },
  };

  const remotes = {
    beginAdd() {
      addDevice.error.set('');
      addDevice.selection.set('');
      addDevice.name.set('');
      addDevice.loading.set(true);
      addDevice.open.set(true);
      void load(false).finally(() => addDevice.loading.set(false));
    },
    choose: remoteFlows.choose,
    moveChoice(direction: -1 | 1) {
      const names = selectableTailnetNames();
      if (names.length === 0) return;
      const current = names.indexOf(addDevice.selection());
      remotes.choose(names[current < 0 ? 0 : (current + direction + names.length) % names.length]);
    },
    submit: remoteFlows.submit,
    remove: remoteFlows.remove,
    retry: () => void refreshRemotes(),
  };

  const forwarding = {
    request(device: DeviceViewModel, serviceID: string) {
      const existing = forwardFor(device, serviceID);
      if (existing?.phase === 'forwarding' || existing?.phase === 'connecting') return;
      void forwarding.start(device, serviceID);
    },
    async start(device: DeviceViewModel, service: string) {
      const key = forwardKey(device, service);
      const attempt = { device, service, phase: 'connecting' } as const;
      forwards.set([...forwards().filter((item) => forwardKey(item.device, item.service) !== key), attempt]);
      // A switch can be turned off while Core is still opening the mapping.
      // Only the attempt that is still current may update the row.
      const current = () => forwards().find((item) => forwardKey(item.device, item.service) === key) === attempt;
      try {
        const payload = await core.openMapping(device.privateName, service);
        if (!payload.url) throw new CoreError(payload.message ?? 'Vela 未能建立本地映射');
        if (!current()) {
          core.closeMapping(device.privateName, service).catch(() => {});
          return;
        }
        const isWeb = payload.url.startsWith('http://');
        const url = payload.url;
        forwards.set(
          forwards().map((item) => (item === attempt ? { device, service, phase: 'forwarding', url } : item)),
        );
        if (isWeb) core.openExternal(url);
      } catch (error) {
        if (!current()) return;
        forwards.set(
          forwards().map((item) =>
            item === attempt ? { device, service, phase: 'failed', message: reason(error) } : item,
          ),
        );
      }
    },
    open(forward: Forward) {
      if (forward.url?.startsWith('http://')) core.openExternal(forward.url);
    },
    copy(text: string) {
      if (text) Clipboard.writeText(text);
    },
    stop(forward: Forward) {
      // A failed attempt holds no mapping; anything else may, including one
      // that is still being opened (start() closes it when it lands).
      if (forward.phase !== 'failed') core.closeMapping(forward.device.privateName, forward.service).catch(() => {});
      forwards.set(
        forwards().filter(
          (item) => forwardKey(item.device, item.service) !== forwardKey(forward.device, forward.service),
        ),
      );
    },
  };

  const preferences = {
    current: preferencesFlow.current,
    update: preferencesFlow.update,
  };

  return {
    // state
    pane,
    selected,
    status,
    network,
    services,
    devices,
    logs,
    activity,
    forwards,
    logLevel,
    authPending,
    authError,
    rechecking,
    addDevice,
    rename,
    editor,
    // derived
    needsAuth,
    protocolVersion,
    signedIn,
    userName,
    userInitial,
    selectedDevice,
    forwardFor,
    tailnetCandidates,
    // flows
    start,
    load,
    refreshDiagnostics,
    navigate,
    account,
    sharing,
    serviceEditor,
    remotes,
    forwarding,
    preferences,
  };
}

export type Store = ReturnType<typeof createStore>;

/** The single store for the app; created once when the shell mounts. */
export const store: Store = createStore();
