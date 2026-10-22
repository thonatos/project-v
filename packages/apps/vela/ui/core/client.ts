/**
 * The only place that talks to Core. Views and features call named functions
 * here instead of hand-rolling a request, parsing JSON and normalising errors
 * at each call site.
 */
import { CoreBridge } from "vela/native";
import type { CoreRemote, CoreStatus, DiagnosticActivity, DiagnosticLogs, Preferences } from "../view-model.d.mts";

/** A failed Core exchange, with the prefix Core adds already stripped. */
export class CoreError extends Error {
  readonly reason: string;

  constructor(message: string) {
    super(message);
    this.name = "CoreError";
    // The host rejects with "<code>: <message>"; the message is what users read.
    this.reason = message.replace(/^Error:\s*/, "").replace(/^[a-z_]+:\s*/, "");
  }
}

interface Envelope<Payload> {
  readonly type: string;
  readonly payload?: Payload;
}

/**
 * Sends one request and returns its payload, asserting the response type so a
 * mismatched envelope fails here rather than surfacing as a missing field.
 */
async function send<Payload>(kind: string, expect: string, body: unknown = {}): Promise<Payload> {
  let raw: string;
  try {
    raw = await CoreBridge.request(kind, JSON.stringify(body));
  } catch (error) {
    throw new CoreError(String(error));
  }
  let envelope: Envelope<Payload>;
  try {
    envelope = JSON.parse(raw) as Envelope<Payload>;
  } catch {
    throw new CoreError(`${kind} 返回了无法解析的响应`);
  }
  if (envelope.type !== expect || envelope.payload === undefined) {
    throw new CoreError(`${kind} 返回了意外的响应`);
  }
  return envelope.payload;
}

export const core = {
  status: () => send<CoreStatus>("status.get", "status"),
  refreshRemotes: () => send<readonly CoreRemote[]>("remote.refresh", "remotes"),
  addRemote: (name: string) => send<unknown>("remote.add", "remotes", { name }),
  removeRemote: (name: string) => send<unknown>("remote.remove", "remotes", { name }),
  renameDevice: (name: string) => send<{ deviceName?: string }>("device.update", "status", { name }),

  upsertService: (service: { id: string; name: string; url: string; adapter: string; protocol: "http" | "tcp"; preset: string; shared: boolean }) =>
    send<unknown>("service.upsert", "services", service),
  removeService: (id: string) => send<unknown>("service.remove", "services", { id }),

  openMapping: (device: string, service: string) =>
    send<{ url?: string; message?: string }>("mapping.open", "mapping", { device, service }),
  closeMapping: (device: string, service: string) =>
    send<unknown>("mapping.close", "mapping", { device, service }),

  startAuth: () => send<{ authUrl?: string }>("auth.start", "auth.url"),
  reconnect: () => send<{ state?: string }>("auth.reconnect", "status"),
  logout: () => send<unknown>("auth.logout", "status"),

  updateSharing: (sharing: { enabled: boolean; opencode: boolean; dsh: boolean }) =>
    send<unknown>("sharing.update", "sharing", sharing),
  updatePreferences: (preferences: Preferences) => send<unknown>("preferences.update", "preferences", preferences),

  logs: () => send<DiagnosticLogs>("diagnostics.logs", "diagnostics.logs"),
  activity: () => send<DiagnosticActivity>("diagnostics.activity", "diagnostics.activity"),

  /** Hands a URL to the user's default browser. */
  openExternal: (url: string) => CoreBridge.openExternal(url),
  setPerformanceHud: (enabled: boolean) => CoreBridge.setPerformanceHud(enabled),
};
