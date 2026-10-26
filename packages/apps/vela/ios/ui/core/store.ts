/**
 * iOS application state: the selected service stage, the flat service list,
 * device registration, authentication and diagnostics. Only `client.ts` knows
 * the Core transport.
 */
import { batch, cleanup, computed, signal } from 'nsh';
import { AlertDialog } from 'nsh/base';
import { Storage } from 'nsh/storage';
import type { DeviceViewModel, ServiceViewModel } from '../../../shared/ui/model';
import { connectionLabel, groupServicesByDevice, isRecentService, remoteDevices } from '../../../shared/ui/devices';
import { diagnosticSnapshot } from '../../../shared/ui/diagnostics';
import { createAuthFlows } from '../../../shared/ui/flows/auth';
import { createPreferencesFlow } from '../../../shared/ui/flows/preferences';
import { createRemoteFlows } from '../../../shared/ui/flows/remotes';
import { createRenameFlow } from '../../../shared/ui/flows/rename';
import {
  signedIn as identitySignedIn,
  userInitial as identityInitial,
  userLabel as identityLabel,
} from '../../../shared/ui/identity';
import { logRows } from '../../../shared/ui/logs';
import type { CoreStatus, DiagnosticActivity, DiagnosticLogs, Preferences } from '../../../shared/ui/protocol';
import { createLatestOperation, createTimeoutOwner } from '../../../shared/ui/operations';
import { copyText } from '../../../shared/ui/clipboard';
import { core, CoreError } from './client';

export type StageFailure = 'offline' | 'auth' | 'unavailable' | 'unsupported' | 'unknown';

export type Stage =
  | { readonly phase: 'empty' }
  | { readonly phase: 'connecting'; readonly device: DeviceViewModel; readonly service: ServiceViewModel }
  | {
      readonly phase: 'ready';
      readonly device: DeviceViewModel;
      readonly service: ServiceViewModel;
      readonly url: string;
    }
  | {
      readonly phase: 'error';
      readonly device: DeviceViewModel;
      readonly service: ServiceViewModel;
      readonly failure: StageFailure;
      readonly message: string;
    };

export type Tab = 'services' | 'devices' | 'logs' | 'settings' | 'me';

/** Modal pages over the tabs. Devices, logs and settings are tabs, not modals. */
export type Modal = 'rename' | 'device' | 'add';

export interface ServiceRow {
  readonly device: DeviceViewModel;
  readonly service: ServiceViewModel;
}

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

function classify(message: string): StageFailure {
  const lower = message.toLowerCase();
  if (lower.includes('reject') || lower.includes('unauthor') || lower.includes('needs') || lower.includes('sign in'))
    return 'auth';
  if (
    lower.includes('offline') ||
    lower.includes('refused') ||
    lower.includes('unreachable') ||
    lower.includes('timeout') ||
    lower.includes('dial')
  )
    return 'offline';
  if (lower.includes('not currently published') || lower.includes('not published') || lower.includes('incompatible'))
    return 'unavailable';
  return 'unknown';
}

export function failureTitle(failure: StageFailure): string {
  switch (failure) {
    case 'offline':
      return '远端设备离线';
    case 'auth':
      return '需要重新认证';
    case 'unavailable':
      return '服务当前不可用';
    case 'unsupported':
      return 'iOS 不支持该协议';
    default:
      return '无法打开服务';
  }
}

export function failureDetail(failure: StageFailure): string {
  switch (failure) {
    case 'offline':
      return '请确认 Mac 上的 Vela 正在运行且两台设备都在同一 Tailnet 中。连接恢复后会自动重试。';
    case 'auth':
      return '这台 iPhone 的身份可能已过期或被移除。请到设置中重新连接。';
    case 'unavailable':
      return '远端可能已停止共享该服务，或清单版本不兼容。下拉刷新设备后再试。';
    case 'unsupported':
      return 'TCP 服务（如 SSH、数据库）没有 iOS 访问入口；请在 Mac 上使用。';
    default:
      return 'Vela 无法建立本地映射，请稍后重试。';
  }
}

function createStore() {
  const read =
    <T>(source: () => T): (() => T) =>
    () =>
      source();
  const status = signal<CoreStatus | null>(null);
  const devices = signal<DeviceViewModel[]>([]);
  const stage = signal<Stage>({ phase: 'empty' });
  const browsing = signal(false);
  const tab = signal<Tab>('services');
  /** The browser toolbar is collapsed to its indicator while the page scrolls down. */
  const toolbarCollapsed = signal(false);
  const canGoBack = signal(false);
  /** Whether the open page's top is dark (it decides the status bar). */
  const pageDark = signal<boolean | null>(null);

  const canGoForward = signal(false);
  /** Modal pages, bottom to top. Closing pops one; `closeAll` returns to the shell. */
  const modals = signal<Modal[]>([]);
  const deviceID = signal('');
  const pageLoading = signal(false);
  const pageError = signal('');
  const pageTitle = signal('');
  const reloadRequest = signal(0);

  const authPending = signal(false);
  const authError = signal('');
  const rechecking = signal(false);
  const signingExpiry = signal('');

  const addDevice = {
    name: signal(''),
    selection: signal(''),
    busy: signal(false),
    loading: signal(false),
    error: signal(''),
  };
  const rename = { draft: signal(''), busy: signal(false), error: signal('') };
  const diagnostics = signal<DiagnosticLogs | null>(null);
  const activity = signal<DiagnosticActivity | null>(null);
  const avatarSource = signal<string | undefined>();
  const logLevel = signal<'all' | 'error' | 'warn' | 'info'>('all');
  const lastVisited = signal<{ device: string; service: string } | null>(null);
  const loading = signal(true);
  const refreshing = signal(false);
  /** What was just copied, shown briefly as feedback. */
  const copied = signal<'' | 'diagnostics' | 'logs'>('');
  const copyError = signal('');
  let copyTimer: number | undefined;

  let started = false;
  let timer: number | undefined;
  let retryTimer: number | undefined;
  let attemptToken = 0;
  let lastRefresh = 0;
  let pendingLoad: Promise<void> | null = null;
  let stopped = false;
  const timeouts = createTimeoutOwner();
  const statusOperation = createLatestOperation();
  const remoteOperation = createLatestOperation((active) => refreshing.set(active));
  const diagnosticsOperation = createLatestOperation();

  const top = () => modals().at(-1) ?? null;
  const isOpen = (modal: Modal) => modals().includes(modal);
  const network = () => status()?.network ?? 'offline';
  const protocolVersion = () => String(core.protocolVersion());
  const needsAuth = () => network() === 'needs-auth';
  const device = computed(() => devices().find((item) => item.id === deviceID()));
  const tailnetCandidates = computed(() =>
    [...(status()?.tailnetDevices ?? [])].sort(
      (left, right) => Number(right.online) - Number(left.online) || left.name.localeCompare(right.name),
    ),
  );
  const selectableTailnetNames = computed(() =>
    tailnetCandidates()
      .map((item) => item.dnsName ?? '')
      .filter((name) => name && !devices().some((item) => item.privateName === name)),
  );
  const signedIn = computed(() => identitySignedIn(status()));
  const userName = computed(() => identityLabel(status()));
  const userInitial = computed(() => identityInitial(status()));
  const isRecent = (row: { device: DeviceViewModel; service: ServiceViewModel }) =>
    isRecentService(lastVisited(), row.device, row.service);
  const deviceGroups = computed(() => groupServicesByDevice(devices(), lastVisited()));
  const rows = computed((): ServiceRow[] =>
    devices()
      .flatMap((item) => item.services.map((service) => ({ device: item, service })))
      .sort(
        (left, right) =>
          Number(isRecent(right)) - Number(isRecent(left)) ||
          Number(right.device.connection === 'connected') - Number(left.device.connection === 'connected') ||
          left.device.name.localeCompare(right.device.name) ||
          left.service.name.localeCompare(right.service.name),
      ),
  );
  const currentService = computed(() => {
    const value = stage();
    return value.phase === 'empty' ? null : { device: value.device, service: value.service };
  });

  function load(refreshDevices = false): Promise<void> {
    if (pendingLoad) return pendingLoad;
    const attempt = statusOperation.begin();
    pendingLoad = (async () => {
      try {
        const next = await core.status();
        if (!attempt.current()) return;
        batch(() => {
          status.set(next);
          devices.set(remoteDevices(next.remotes));
          if (next.signing?.expiresAt) signingExpiry.set(next.signing.expiresAt);
          if (next.network === 'connected' || next.network === 'needs-auth') authPending.set(false);
          avatarSource.set(next.preferences?.gravatarAvatar ? next.avatarUrl : undefined);
          loading.set(false);
        });
        reconcileStage();
        if (refreshDevices) await refreshRemotes();
        else if (next.network === 'connected' && Date.now() - lastRefresh > 30_000) await refreshRemotes();
      } catch (error) {
        if (attempt.current()) loading.set(false);
        console.error('VELA_IOS_STATE status-load-failed', reason(error));
      } finally {
        attempt.end();
        pendingLoad = null;
      }
    })();
    return pendingLoad;
  }

  async function refreshRemotes(): Promise<void> {
    lastRefresh = Date.now();
    const attempt = remoteOperation.begin();
    try {
      const next = remoteDevices(await core.refreshRemotes());
      if (attempt.current()) {
        devices.set(next);
        reconcileStage();
      }
    } catch (error) {
      console.error('VELA_IOS_STATE remote-refresh-failed', reason(error));
    } finally {
      attempt.end();
    }
  }

  /** Keeps the stage context but reflects a service that disappeared. */
  function reconcileStage() {
    const current = currentService();
    if (!current) return;
    const updatedDevice = devices().find((item) => item.id === current.device.id);
    const updatedService = updatedDevice?.services.find((item) => item.id === current.service.id);
    if (!updatedDevice || !updatedService) {
      stage.set({
        phase: 'error',
        device: current.device,
        service: current.service,
        failure: 'unavailable',
        message: '该服务已不在远端共享清单中',
      });
      return;
    }
    const value = stage();
    if (value.phase === 'connecting')
      stage.set({ phase: 'connecting', device: updatedDevice, service: updatedService });
    if (value.phase === 'ready')
      stage.set({ phase: 'ready', device: updatedDevice, service: updatedService, url: value.url });
    if (value.phase === 'error')
      stage.set({
        phase: 'error',
        device: updatedDevice,
        service: updatedService,
        failure: value.failure,
        message: value.message,
      });
  }

  function schedule(): void {
    timeouts.cancel(timer);
    if (stopped) return;
    const delay = needsAuth() ? 4_000 : network() === 'connected' ? 6_000 : 2_000;
    timer = timeouts.schedule(() => {
      void load().finally(schedule);
    }, delay) as number;
  }

  function start(): void {
    if (started) return;
    started = true;
    stopped = false;
    try {
      core.start();
    } catch (error) {
      console.error('VELA_IOS_STATE core-start-failed', reason(error));
    }
    void Storage.getItem('vela:last-service').then((raw) => {
      if (!raw) return;
      try {
        const value = JSON.parse(raw) as { device?: string; service?: string };
        if (value.device && value.service) lastVisited.set({ device: value.device, service: value.service });
      } catch {
        // Ignore a stale or corrupt preference; the list still works.
      }
    });
    void load().finally(schedule);
    cleanup(stop);
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    started = false;
    attemptToken += 1;
    timeouts.stop();
    statusOperation.stop();
    remoteOperation.stop();
    diagnosticsOperation.stop();
  }

  function clearRetry(): void {
    timeouts.cancel(retryTimer);
    retryTimer = undefined;
  }

  async function openService(
    targetDevice: DeviceViewModel,
    targetService: ServiceViewModel,
    automatic = false,
  ): Promise<void> {
    const existing = stage();
    if (
      existing.phase === 'ready' &&
      existing.device.id === targetDevice.id &&
      existing.service.id === targetService.id
    ) {
      // Going back to the list keeps the WebView mounted; returning to the
      // same service only reveals it again.
      batch(() => {
        browsing.set(true);
        modals.set([]);
      });
      return;
    }
    if (targetService.protocol === 'tcp') return;
    if (needsAuth()) {
      batch(() => {
        stage.set({
          phase: 'error',
          device: targetDevice,
          service: targetService,
          failure: 'auth',
          message: failureDetail('auth'),
        });
        browsing.set(true);
        modals.set([]);
      });
      return;
    }
    const current = currentService();
    if (current && (current.device.id !== targetDevice.id || current.service.id !== targetService.id)) {
      void core.closeMapping(current.device.privateName, current.service.id).catch(() => {});
    }
    clearRetry();
    const token = ++attemptToken;
    batch(() => {
      stage.set({ phase: 'connecting', device: targetDevice, service: targetService });
      pageDark.set(null);
      pageError.set('');
      pageTitle.set('');
      pageLoading.set(true);
      toolbarCollapsed.set(false);
      canGoBack.set(false);
      canGoForward.set(false);
      browsing.set(true);
      modals.set([]);
    });
    try {
      const payload = await core.openMapping(targetDevice.privateName, targetService.id);
      if (token !== attemptToken) return;
      if (!payload.url) throw new CoreError(payload.message ?? 'Vela 未能建立本地映射');
      stage.set({ phase: 'ready', device: targetDevice, service: targetService, url: payload.url });
      lastVisited.set({ device: targetDevice.privateName, service: targetService.id });
      void Storage.setItem(
        'vela:last-service',
        JSON.stringify({ device: targetDevice.privateName, service: targetService.id }),
      ).catch((error) => console.error('VELA_IOS_STATE recent-service-save-failed', reason(error)));
    } catch (error) {
      if (token !== attemptToken) return;
      const message = reason(error);
      const failure = classify(message);
      stage.set({ phase: 'error', device: targetDevice, service: targetService, failure, message });
      if (!automatic && failure !== 'auth' && failure !== 'unsupported') {
        // One bounded automatic retry; the alert also offers a manual retry.
        retryTimer = timeouts.schedule(() => {
          const latest = currentService();
          if (latest) void openService(latest.device, latest.service, true);
        }, 2_000);
      }
      console.error('VELA_IOS_STATE mapping-failed', message);
    }
  }

  const navigation = {
    /** Back to the tabs; the page stays loaded underneath. */
    home() {
      batch(() => {
        browsing.set(false);
        toolbarCollapsed.set(false);
      });
    },
    /** Return to the page kept under the list. */
    resume() {
      if (stage().phase !== 'empty') {
        batch(() => {
          browsing.set(true);
          toolbarCollapsed.set(false);
        });
      }
    },
    push(modal: Modal) {
      if (top() === modal) return;
      modals.set([...modals().filter((item) => item !== modal), modal]);
      if (modal === 'device') diagnosticsActions.refresh();
    },
    /** Pops the top modal: Done and swipe-down both land on the parent. */
    pop() {
      modals.set(modals().slice(0, -1));
    },
    /** A sheet dismissed natively: drop it and everything above it. */
    dismiss(modal: Modal) {
      const index = modals().indexOf(modal);
      if (index >= 0) modals.set(modals().slice(0, index));
    },
    closeAll: () => modals.set([]),
    select(next: Tab) {
      tab.set(next);
      if (next === 'logs') diagnosticsActions.refresh();
    },
    /** The "me" tab holds the account; leave the browser to show it. */
    account: () => {
      batch(() => {
        browsing.set(false);
        modals.set([]);
      });
      navigation.select('me');
    },
    devices: () => {
      browsing.set(false);
      navigation.select('devices');
    },
    device(id: string) {
      deviceID.set(id);
      navigation.push('device');
    },
    add: () => remotes.beginAdd(),
    settings: () => {
      browsing.set(false);
      navigation.select('settings');
    },
    logs: () => {
      browsing.set(false);
      navigation.select('logs');
    },
    open: (targetDevice: DeviceViewModel, targetService: ServiceViewModel) =>
      void openService(targetDevice, targetService),
    retry: () => {
      const current = currentService();
      if (!current) return;
      stage.set({ phase: 'empty' });
      void openService(current.device, current.service);
    },
    closeService() {
      const value = stage();
      if (value.phase !== 'empty') {
        void core.closeMapping(value.device.privateName, value.service.id).catch(() => {});
      }
      clearRetry();
      attemptToken++;
      batch(() => {
        stage.set({ phase: 'empty' });
        browsing.set(false);
      });
    },
  };

  const page = {
    reloadRequest: read(reloadRequest),
    reload: () => reloadRequest.update((value) => value + 1),
    started: () => {
      pageLoading.set(true);
      pageError.set('');
    },
    loaded(title: string) {
      pageLoading.set(false);
      pageError.set('');
      if (title) pageTitle.set(title);
    },
    failed(message: string) {
      pageLoading.set(false);
      pageError.set(message);
    },
    navigated(state: { loading: boolean; title?: string; canGoBack?: boolean; canGoForward?: boolean }) {
      batch(() => {
        pageLoading.set(state.loading);
        if (state.title) pageTitle.set(state.title);
        canGoBack.set(Boolean(state.canGoBack));
        canGoForward.set(Boolean(state.canGoForward));
        if (state.loading) toolbarCollapsed.set(false);
      });
    },
    themed(dark: boolean) {
      pageDark.set(dark);
    },
    statusBar: (style: 'dark' | 'light' | 'app') => core.setPageStatusBar(style),
    scrolled(collapsed: boolean) {
      toolbarCollapsed.set(collapsed);
    },
    expand: () => toolbarCollapsed.set(false),
  };

  // Shared flows: identity, rename, saved devices and preferences. Platform
  // wording and the steps after each action stay here.
  const auth = createAuthFlows({
    transaction: batch,
    core,
    openExternal: core.openExternal,
    pending: authPending,
    error: authError,
    rechecking,
    load: (refresh) => load(refresh),
    isConnected: () => network() === 'connected',
    confirmLogout: () =>
      AlertDialog.show({
        title: '注销这台 iPhone？',
        description: '将移除保存的身份；需要重新认证后才能访问远端服务。',
        actions: [
          { label: '取消', role: 'cancel', id: 'cancel' },
          { label: '注销', role: 'destructive', id: 'confirm' },
        ],
      }).then((choice) => choice === 'confirm'),
    messages: {
      startFailed: '无法开始私人连接。请检查网络后重试。',
      notConnected: '尚未连接。完成浏览器认证后再次检查。',
      reconnectFailed: '检查失败，请稍后重试。',
      recheckFailed: '检查失败，请稍后重试。',
    },
    tag: 'VELA_IOS_STATE',
    onLogoutError: (cause) => authError.set(reason(cause)),
  });

  const renameFlow = createRenameFlow({
    transaction: batch,
    core,
    status,
    draft: rename.draft,
    error: rename.error,
    busy: rename.busy,
    initial: () => {
      const current = status()?.deviceName ?? '';
      // The system's generic "iPhone" is not a name: start from empty so the
      // placeholder suggests one.
      return /^iphone$/i.test(current.trim()) ? '' : current;
    },
    open: () => navigation.push('rename'),
    close: () => navigation.dismiss('rename'),
    messages: {
      empty: '请输入设备名称。',
      invalid: '只能使用字母、数字和连字符，且以字母或数字开头，最多 63 个字符。',
    },
  });

  const remoteFlows = createRemoteFlows({
    transaction: batch,
    core,
    addDevice,
    load: () => refreshRemotes(),
    afterAdd: () => navigation.dismiss('add'),
    confirmRemove: (target) =>
      AlertDialog.show({
        title: `移除 ${target.name}？`,
        description: '只会删除这台 iPhone 上保存的设备，不影响那台设备上的 Vela。',
        actions: [
          { label: '取消', role: 'cancel', id: 'cancel' },
          { label: '移除', role: 'destructive', id: 'confirm' },
        ],
      }).then((choice) => choice === 'confirm'),
    afterConfirmed: (target) => {
      const current = currentService();
      if (current?.device.id === target.id) navigation.closeService();
    },
    onRemoved: () => navigation.dismiss('device'),
    messages: { chooseDevice: '请选择一台 Tailnet 设备，或输入完整私人名称。' },
    tag: 'VELA_IOS_STATE',
  });

  const preferencesFlow = createPreferencesFlow({
    core,
    status,
    // App.tsx applies the appearance from the preferences signal; updating the
    // snapshot below is what triggers it.
    apply: (next) => {
      if (!next.gravatarAvatar) avatarSource.set(undefined);
    },
    onSaved: () => void load(),
    tag: 'VELA_IOS_STATE',
  });

  const remotes = {
    refresh: () => void refreshRemotes(),
    beginAdd() {
      addDevice.error.set('');
      addDevice.name.set('');
      addDevice.selection.set('');
      addDevice.loading.set(true);
      navigation.push('add');
      void load(false).finally(() => addDevice.loading.set(false));
    },
    choose: remoteFlows.choose,
    setAddName: remoteFlows.setAddName,
    submitAdd: remoteFlows.submit,
    remove: remoteFlows.remove,
  };

  const account = {
    signIn: auth.signIn,
    check: () => auth.reconnect({ failure: (cause) => reason(cause) }),
    recheck: () => auth.reconnect(),
    beginRename: renameFlow.begin,
    saveRename: renameFlow.save,
    logout: auth.logout,
    changeRenameDraft(value: string) {
      batch(() => {
        rename.draft.set(value);
        rename.error.set('');
      });
    },
  };

  const preferences = {
    current: (): Preferences => ({ ...preferencesFlow.current(), performanceHud: false }),
    update: preferencesFlow.update,
  };

  function flash(what: 'diagnostics' | 'logs') {
    copied.set(what);
    timeouts.cancel(copyTimer);
    copyTimer = timeouts.schedule(() => copied.set(''), 1_600) as number;
  }

  const diagnosticsActions = {
    async refresh() {
      const attempt = diagnosticsOperation.begin();
      const [nextLogs, nextActivity] = await Promise.allSettled([core.logs(), core.activity()]);
      if (attempt.current())
        batch(() => {
          if (nextLogs.status === 'fulfilled') diagnostics.set(nextLogs.value);
          if (nextActivity.status === 'fulfilled') activity.set(nextActivity.value);
        });
      if (nextLogs.status === 'rejected') console.error('VELA_IOS_STATE diagnostics-failed', reason(nextLogs.reason));
      if (nextActivity.status === 'rejected')
        console.error('VELA_IOS_STATE activity-failed', reason(nextActivity.reason));
      attempt.end();
    },
    /** The redacted status snapshot (settings → 复制诊断信息). */
    copy() {
      const snapshot = status();
      const version = protocolVersion();
      const text = snapshot ? diagnosticSnapshot(snapshot, version) : JSON.stringify({ version, redacted: true });
      void copyText(text).then((copied) => {
        copyError.set(copied ? '' : '无法写入剪贴板，请检查应用权限。');
        if (copied) flash('diagnostics');
      });
    },
    /** The journal lines the logs tab shows, at its current level. */
    copyLogs() {
      const lines = logRows(diagnostics(), logLevel()).map(
        (row) => `${row.time} ${row.levelLabel} ${row.area} ${row.message}`,
      );
      void copyText(lines.join('\n')).then((copied) => {
        copyError.set(copied ? '' : '无法写入剪贴板，请检查应用权限。');
        if (copied) flash('logs');
      });
    },
  };

  const logsView = { selectLevel: (level: 'all' | 'error' | 'warn' | 'info') => logLevel.set(level) };
  const avatar = {
    source: read(avatarSource),
  };

  return {
    status: read(status),
    devices: read(devices),
    stage: read(stage),
    browsing: read(browsing),
    modals: read(modals),
    deviceID: read(deviceID),
    authPending: read(authPending),
    authError: read(authError),
    rechecking: read(rechecking),
    signingExpiry: read(signingExpiry),
    addDevice: {
      name: read(addDevice.name),
      selection: read(addDevice.selection),
      busy: read(addDevice.busy),
      loading: read(addDevice.loading),
      error: read(addDevice.error),
    },
    rename: { draft: read(rename.draft), busy: read(rename.busy), error: read(rename.error) },
    diagnostics: read(diagnostics),
    pageLoading: read(pageLoading),
    pageError: read(pageError),
    pageTitle: read(pageTitle),
    tab: read(tab),
    toolbarCollapsed: read(toolbarCollapsed),
    canGoBack: read(canGoBack),
    canGoForward: read(canGoForward),
    pageDark: read(pageDark),
    network,
    protocolVersion,
    needsAuth,
    loading: read(loading),
    refreshing: read(refreshing),
    copied: read(copied),
    copyError: read(copyError),
    signedIn,
    userName,
    userInitial,
    device,
    rows,
    deviceGroups,
    currentService,
    tailnetCandidates,
    selectableTailnetNames,
    lastVisited: read(lastVisited),
    isRecent,
    logLevel: read(logLevel),
    activity: read(activity),
    top,
    isOpen,
    start,
    stop,
    load,
    refreshRemotes,
    navigation,
    page,
    remotes,
    account,
    preferences,
    diagnosticsActions,
    logsView,
    avatar,
    connectionLabel,
  };
}

export type Store = ReturnType<typeof createStore>;

/** The single store for the app; created once when the shell mounts. */
export const store: Store = createStore();
