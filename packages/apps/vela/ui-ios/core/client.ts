/**
 * The only module that talks to Core on iOS. The transport is the Rust
 * `CoreBridge`, but the envelope and error normalization are shared with the
 * macOS client.
 */
import { CoreBridge } from "vela/native";
import { CoreError, parseEnvelope } from "../../ui-shared/envelope";
import type { CoreRemote, CoreStatus, DiagnosticActivity, DiagnosticLogs, Preferences } from "../../ui-shared/protocol";

export { CoreError };

async function send<Payload>(kind: string, expect: string, body: unknown = {}): Promise<Payload> {
  let raw: string;
  try {
    raw = await CoreBridge.request(kind, JSON.stringify(body));
  } catch (error) {
    throw new CoreError(String(error));
  }
  return parseEnvelope<Payload>(kind, expect, raw);
}

export const core = {
  protocolVersion: () => CoreBridge.protocolVersion(),
  start: () => CoreBridge.start(""),

  status: () => send<CoreStatus>("status.get", "status"),
  refreshRemotes: () => send<readonly CoreRemote[]>("remote.refresh", "remotes"),
  addRemote: (name: string) => send<unknown>("remote.add", "remotes", { name }),
  removeRemote: (name: string) => send<unknown>("remote.remove", "remotes", { name }),
  renameDevice: (name: string) => send<{ deviceName?: string }>("device.update", "status", { name }),

  openMapping: (device: string, service: string) =>
    send<{ url?: string; message?: string }>("mapping.open", "mapping", { device, service }),
  closeMapping: (device: string, service: string) =>
    send<unknown>("mapping.close", "mapping", { device, service }),

  startAuth: () => send<{ authUrl?: string }>("auth.start", "auth.url"),
  reconnect: () => send<{ state?: string }>("auth.reconnect", "status"),
  logout: () => send<unknown>("auth.logout", "status"),

  updatePreferences: (preferences: Preferences) => send<unknown>("preferences.update", "preferences", preferences),

  logs: () => send<DiagnosticLogs>("diagnostics.logs", "diagnostics.logs"),
  activity: () => send<DiagnosticActivity>("diagnostics.activity", "diagnostics.activity"),

  openExternal: (url: string) => CoreBridge.openExternal(url),
  drainEvents: () => CoreBridge.drainEvents(),
  setPageStatusBar: (style: "dark" | "light" | "app") => CoreBridge.setPageStatusBar(style),
};
