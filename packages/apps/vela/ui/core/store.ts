/**
 * Application state and the flows that change it. Features read signals and
 * call actions here; only this module and `client.ts` know Core exists.
 */
import { cleanup, effect, signal } from "nsh";
import { setColorScheme } from "nsh/device";
import { Clipboard } from "nsh/clipboard";
import { Alert } from "nsh/ui/mobile";
import type { DeviceViewModel, ServiceProtocol, ServiceViewModel } from "../model";
import type { LinkPhase } from "../ui";
import {
  appearancePreference,
  dshMappingURL,
  localServices,
  nextDeviceID,
  presetFor,
  presetForService,
  remoteAddError,
  remoteDevices,
  serviceFormError,
  serviceTargetURL,
  shareWarning,
  type CoreStatus,
  type DiagnosticActivity,
  type DiagnosticLogs,
  type LogLevel,
  type Preferences,
  type PresetValue,
} from "../view-model.mjs";
import { core, CoreError } from "./client";

export type Pane = "devices" | "forwards" | "logs" | "account" | "settings";

/** One remote service Vela forwards to a stable loopback address. */
export interface Forward {
  readonly device: DeviceViewModel;
  readonly service: string;
  readonly phase: LinkPhase;
  readonly url?: string;
  readonly message?: string;
}

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

function createStore() {
  // Navigation
  const pane = signal<Pane>("devices");
  const selected = signal("");

  // Core snapshot
  const status = signal<CoreStatus | null>(null);
  const network = signal<DeviceViewModel["connection"]>("needs-auth");
  const services = signal<ServiceViewModel[]>([]);
  const devices = signal<DeviceViewModel[]>([]);
  const logs = signal<DiagnosticLogs | null>(null);
  const activity = signal<DiagnosticActivity | null>(null);
  const forwards = signal<Forward[]>([]);

  // Sign-in
  const authPending = signal(false);
  const authError = signal("");
  const rechecking = signal(false);

  // Add device
  const addDevice = { open: signal(false), name: signal(""), selection: signal(""), busy: signal(false), loading: signal(false), error: signal("") };
  // Rename this Mac
  const rename = { open: signal(false), draft: signal(""), error: signal("") };
  // Add or edit a local service
  const editor = {
    open: signal(false),
    editing: signal(""),
    preset: signal<PresetValue>("custom-http"),
    id: signal(""),
    name: signal(""),
    target: signal(""),
    protocol: signal<ServiceProtocol>("http"),
    adapter: signal(""),
    error: signal(""),
  };
  // DSH authentication before its first forward
  const dsh = { target: signal<{ device: DeviceViewModel; service: string } | null>(null), url: signal(""), error: signal("") };

  // Logs page
  const logLevel = signal<LogLevel | "all">("all");

  let pending: Promise<CoreStatus | null> | null = null;
  let timer: number | undefined;

  const needsAuth = () => network() === "needs-auth";
  const selectedDevice = () => devices().find((device) => device.id === selected());
  const forwardKey = (device: DeviceViewModel, service: string) => `${device.id}/${service}`;
  const forwardFor = (device: DeviceViewModel, service: string) => forwards().find((item) => forwardKey(item.device, item.service) === forwardKey(device, service));
  const tailnetCandidates = () => [...(status()?.tailnetDevices ?? [])].sort((left, right) => Number(right.online) - Number(left.online) || left.name.localeCompare(right.name));
  const selectableTailnetNames = () => tailnetCandidates().map((device) => device.dnsName ?? "").filter((name) => name && !devices().some((device) => device.privateName === name));

  async function refreshRemotes() {
    const current = devices();
    if (current.length === 0) return;
    devices.set(current.map((device) => ({ ...device, connection: "connecting" })));
    try {
      devices.set(remoteDevices(await core.refreshRemotes()));
    } catch (error) {
      devices.set(current.map((device) => ({ ...device, connection: "offline", issue: "offline" })));
      console.error("VELA_STATE remote-refresh-failed", reason(error));
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
        if (next.network === "connected" || next.network === "needs-auth") {
          authPending.set(false);
        }
        services.set(localServices(next));
        devices.set(remoteDevices(next.remotes));
        setColorScheme(appearancePreference(next));
        core.setPerformanceHud(next.preferences?.performanceHud ?? false);
        if (refreshRemoteDevices && next.network === "connected" && next.remotes.some((remote) => remote.connection !== "connecting")) void refreshRemotes();
        return next;
      } catch (error) {
        network.set("offline");
        console.error("VELA_STATE status-load-failed", reason(error));
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
    if (next?.network === "connected" && before !== "connected") void refreshRemotes();
    const delay = next?.network === "connected" ? 10_000 : next?.network === "needs-auth" ? 5_000 : 1_000;
    timer = setTimeout(() => void poll(), delay);
  }

  function refreshDiagnostics() {
    core.activity().then((value) => activity.set(value)).catch((error) => console.error("VELA_STATE diagnostics-activity-failed", reason(error)));
    core.logs().then((value) => logs.set(value)).catch((error) => console.error("VELA_STATE diagnostics-logs-failed", reason(error)));
  }

  /** Starts polling, plus diagnostics while a page that shows them is open. */
  function start() {
    void poll();
    cleanup(() => clearTimeout(timer));
    effect(() => {
      if (pane() !== "logs" && !(pane() === "devices" && selected() && selected() !== "this-mac")) return;
      refreshDiagnostics();
      const interval = setInterval(refreshDiagnostics, 5_000);
      cleanup(() => clearInterval(interval));
    });
  }

  const navigate = {
    devices: () => { selected.set(""); pane.set("devices"); },
    forwards: () => pane.set("forwards"),
    logs: () => { pane.set("logs"); refreshDiagnostics(); },
    account: () => pane.set("account"),
    settings: () => pane.set("settings"),
    select(id: string) {
      selected.set(id);
      pane.set("devices");
      if (id !== "this-mac") void refreshRemotes();
    },
    back() {
      if (pane() === "devices" && selected()) navigate.devices();
    },
    moveSelection(direction: -1 | 1) {
      if (pane() !== "devices") return;
      selected.set(nextDeviceID(selected(), devices().map((device) => device.id), direction));
    },
  };

  const account = {
    signIn() {
      authError.set("");
      authPending.set(true);
      core.startAuth().then((payload) => {
        if (!payload.authUrl) throw new CoreError("未收到登录地址");
        core.openExternal(payload.authUrl);
      }).catch((error) => {
        authPending.set(false);
        authError.set("无法开始私人连接。请检查网络后重试。");
        console.error("VELA_STATE auth-start-failed", reason(error));
      });
    },
    check() {
      void load(true).then(() => {
        if (network() !== "connected") authError.set("尚未连接。完成浏览器认证后再次检查。");
        else { authPending.set(false); authError.set(""); }
      });
    },
    reconnect() {
      // A re-check makes the node log in to control again, which takes a few
      // seconds; it is the only way a device removed in the admin console is
      // found out while Vela is running.
      if (rechecking()) return;
      rechecking.set(true);
      authError.set("");
      core.reconnect()
        .then((result) => {
          if (result.state === "needs-auth") authPending.set(false);
          return load(true);
        })
        .catch((error) => {
          authError.set("无法完成检查，请稍后重试。");
          console.error("VELA_STATE auth-reconnect-failed", reason(error));
        })
        .finally(() => rechecking.set(false));
    },
    logout() {
      void Alert.alert("注销这台 Mac？", "将移除这台 Mac 上保存的身份，共享与转发会停止。", [{ text: "取消", style: "cancel" }, { text: "注销", style: "destructive" }]).then((choice) => {
        if (choice === 1) core.logout().then(() => load()).catch((error) => console.error("VELA_STATE auth-logout-failed", reason(error)));
      });
    },
    beginRename() {
      rename.draft.set(status()?.deviceName ?? "");
      rename.error.set("");
      rename.open.set(true);
    },
    saveRename() {
      const name = rename.draft().trim();
      if (!name) { rename.error.set("请输入设备名称。"); return; }
      core.renameDevice(name).then((payload) => {
        const effective = payload.deviceName ?? name;
        const current = status();
        if (current) status.set({ ...current, deviceName: effective, tailscale: { ...current.tailscale, name: effective } });
        rename.open.set(false);
        setTimeout(() => void load(), 1_000);
      }).catch((error) => rename.error.set(reason(error)));
    },
  };

  const sharing = {
    setEnabled(enabled: boolean) {
      const current = status();
      if (current) status.set({ ...current, sharing: { ...current.sharing, enabled } });
      core.updateSharing({ enabled, opencode: current?.sharing.opencode ?? false, dsh: current?.sharing.dsh ?? false })
        .catch((error) => { console.error("VELA_STATE sharing-update-failed", reason(error)); void load(); });
    },
    setServiceShared(service: ServiceViewModel, shared: boolean) {
      const commit = () => core.upsertService({
        id: service.id,
        name: service.name,
        url: service.url ?? "",
        adapter: service.adapter ?? "",
        protocol: service.protocol,
        preset: service.preset ?? "",
        shared,
      })
        .then(() => load())
        .catch((error) => { console.error("VELA_STATE service-update-failed", reason(error)); void load(); });
      services.set(services().map((item) => (item.id === service.id ? { ...item, shared } : item)));
      if (!shared) { void commit(); return; }
      const warning = shareWarning(service);
      void Alert.alert(warning.title, warning.message, [{ text: "取消", style: "cancel" }, { text: "确认共享", style: "destructive" }]).then((choice) => {
        if (choice === 1) void commit();
        else services.set(services().map((item) => (item.id === service.id ? { ...item, shared: false } : item)));
      });
    },
  };

  const serviceEditor = {
    applyPreset(value: PresetValue) {
      const preset = presetFor(value);
      editor.preset.set(preset.preset);
      editor.id.set(preset.id);
      editor.name.set(preset.name);
      editor.target.set(preset.protocol === "tcp" ? preset.url.replace(/^tcp:\/\//, "") : preset.url);
      editor.protocol.set(preset.protocol);
      editor.adapter.set(preset.adapter);
      editor.error.set("");
    },
    begin(service?: ServiceViewModel) {
      if (service) {
        editor.editing.set(service.id);
        editor.preset.set(presetForService(service));
        editor.id.set(service.id);
        editor.name.set(service.name);
        editor.target.set(service.protocol === "tcp" ? service.subtitle : service.url ?? "");
        editor.protocol.set(service.protocol);
        editor.adapter.set(service.adapter ?? "");
        editor.error.set("");
      } else {
        editor.editing.set("");
        serviceEditor.applyPreset("custom-http");
      }
      editor.open.set(true);
    },
    save() {
      const protocol = editor.protocol();
      const problem = serviceFormError(protocol, editor.name(), editor.target());
      if (problem) { editor.error.set(problem); return; }
      const existing = services().find((service) => service.id === editor.id());
      core.upsertService({
        id: editor.id(),
        name: editor.name().trim(),
        url: serviceTargetURL(protocol, editor.target()),
        adapter: protocol === "tcp" ? "" : editor.adapter(),
        protocol,
        preset: editor.preset().startsWith("custom-") ? "" : editor.preset(),
        shared: existing?.shared ?? false,
      }).then(() => { editor.open.set(false); return load(); }).catch((error) => editor.error.set(reason(error)));
    },
    remove(service: ServiceViewModel) {
      void Alert.alert(`删除 ${service.name}？`, "将停止该服务的共享入口，但不会停止本地服务进程。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive" }]).then((choice) => {
        if (choice === 1) core.removeService(service.id).then(() => load()).catch((error) => console.error("VELA_STATE service-remove-failed", reason(error)));
      });
    },
  };

  const remotes = {
    beginAdd() {
      addDevice.error.set("");
      addDevice.selection.set("");
      addDevice.name.set("");
      addDevice.loading.set(true);
      addDevice.open.set(true);
      void load(false).finally(() => addDevice.loading.set(false));
    },
    choose(name: string) {
      addDevice.selection.set(name);
      addDevice.name.set("");
    },
    moveChoice(direction: -1 | 1) {
      const names = selectableTailnetNames();
      if (names.length === 0) return;
      const current = names.indexOf(addDevice.selection());
      remotes.choose(names[current < 0 ? 0 : (current + direction + names.length) % names.length]);
    },
    submit() {
      const name = (addDevice.name().trim() || addDevice.selection()).toLowerCase();
      if (addDevice.busy()) return;
      if (!name) { addDevice.error.set("请选择一台设备，或输入完整私人名称。"); return; }
      addDevice.error.set("");
      addDevice.busy.set(true);
      core.addRemote(name).then(() => {
        addDevice.open.set(false);
        return load();
      }).catch((error) => {
        addDevice.error.set(remoteAddError(reason(error)));
        console.error("VELA_STATE remote-add-failed", reason(error));
      }).finally(() => addDevice.busy.set(false));
    },
    remove(device: DeviceViewModel) {
      void Alert.alert(`移除 ${device.name}？`, "只会删除这台 Mac 上保存的设备，不会影响另一台 Mac 上的 Vela。", [{ text: "取消", style: "cancel" }, { text: "移除", style: "destructive" }]).then((choice) => {
        if (choice !== 1) return;
        for (const item of forwards().filter((forward) => forward.device.id === device.id)) forwarding.stop(item);
        core.removeRemote(device.privateName).then(() => load()).catch((error) => console.error("VELA_STATE remote-remove-failed", reason(error)));
        if (selected() === device.id) navigate.devices();
      });
    },
    retry: () => void refreshRemotes(),
  };

  const forwarding = {
    request(device: DeviceViewModel, serviceID: string) {
      const existing = forwardFor(device, serviceID);
      if (existing?.phase === "forwarding" || existing?.phase === "connecting") return;
      const service = device.services.find((item) => item.id === serviceID);
      if (service?.adapter === "dsh") {
        // The switch reads the forward list, so hold the row in "connecting"
        // while the sheet asks for an optional URL; cancelling removes it.
        const key = forwardKey(device, serviceID);
        forwards.set([...forwards().filter((item) => forwardKey(item.device, item.service) !== key), { device, service: serviceID, phase: "connecting" }]);
        dsh.target.set({ device, service: serviceID });
        dsh.url.set("");
        dsh.error.set("");
        return;
      }
      void forwarding.start(device, serviceID);
    },
    cancelDSH() {
      const target = dsh.target();
      dsh.target.set(null);
      if (!target) return;
      const key = forwardKey(target.device, target.service);
      forwards.set(forwards().filter((item) => forwardKey(item.device, item.service) !== key));
    },
    startDSH(withURL: boolean) {
      const target = dsh.target();
      if (!target) return;
      const url = withURL ? dsh.url().trim() : "";
      if (url) {
        try {
          dshMappingURL("http://dsh.localhost:1", url);
        } catch {
          dsh.error.set("请粘贴 dsh web 输出的 loopback HTTP 地址。");
          return;
        }
      }
      dsh.target.set(null);
      void forwarding.start(target.device, target.service, url || undefined);
    },
    async start(device: DeviceViewModel, service: string, authenticationURL?: string) {
      const key = forwardKey(device, service);
      const attempt = { device, service, phase: "connecting" } as const;
      forwards.set([...forwards().filter((item) => forwardKey(item.device, item.service) !== key), attempt]);
      // A switch can be turned off while Core is still opening the mapping.
      // Only the attempt that is still current may update the row.
      const current = () => forwards().find((item) => forwardKey(item.device, item.service) === key) === attempt;
      try {
        const payload = await core.openMapping(device.privateName, service);
        if (!payload.url) throw new CoreError(payload.message ?? "Vela 未能建立本地映射");
        if (!current()) {
          core.closeMapping(device.privateName, service).catch(() => {});
          return;
        }
        const definition = device.services.find((item) => item.id === service);
        const isWeb = payload.url.startsWith("http://");
        const url = isWeb && definition?.adapter === "dsh" && authenticationURL ? dshMappingURL(payload.url, authenticationURL) : payload.url;
        forwards.set(forwards().map((item) => (item === attempt ? { device, service, phase: "forwarding", url } : item)));
        if (isWeb) core.openExternal(url);
      } catch (error) {
        if (!current()) return;
        forwards.set(forwards().map((item) => (item === attempt ? { device, service, phase: "failed", message: reason(error) } : item)));
      }
    },
    open(forward: Forward) {
      if (forward.url?.startsWith("http://")) core.openExternal(forward.url);
    },
    copy(text: string) {
      if (text) Clipboard.setString(text);
    },
    stop(forward: Forward) {
      // A failed attempt holds no mapping; anything else may, including one
      // that is still being opened (start() closes it when it lands).
      if (forward.phase !== "failed") core.closeMapping(forward.device.privateName, forward.service).catch(() => {});
      forwards.set(forwards().filter((item) => forwardKey(item.device, item.service) !== forwardKey(forward.device, forward.service)));
    },
  };

  const preferences = {
    current: (): Preferences => ({
      appearance: appearancePreference(status()),
      performanceHud: status()?.preferences?.performanceHud ?? false,
      verboseLogs: status()?.preferences?.verboseLogs ?? false,
    }),
    update(patch: Partial<Preferences>) {
      const next = { ...preferences.current(), ...patch };
      setColorScheme(next.appearance);
      core.setPerformanceHud(next.performanceHud);
      const current = status();
      if (current) status.set({ ...current, preferences: next });
      core.updatePreferences(next).catch((error) => console.error("VELA_STATE preferences-update-failed", reason(error)));
    },
  };

  return {
    // state
    pane, selected, status, network, services, devices, logs, activity, forwards, logLevel,
    authPending, authError, rechecking, addDevice, rename, editor, dsh,
    // derived
    needsAuth, selectedDevice, forwardFor, tailnetCandidates,
    // flows
    start, load, refreshDiagnostics, navigate, account, sharing, serviceEditor, remotes, forwarding, preferences,
  };
}

export type Store = ReturnType<typeof createStore>;

/** The single store for the app; created once when the shell mounts. */
export const store: Store = createStore();
