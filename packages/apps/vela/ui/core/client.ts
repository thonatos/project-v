/**
 * The only place that talks to Core. Views and features call named functions
 * here instead of hand-rolling a request, parsing JSON and normalising errors
 * at each call site.
 */
import { CoreBridge } from "vela/native";
import { CoreError, parseEnvelope } from "../../ui-shared/envelope";
import type { CoreRemote, CoreStatus, DiagnosticActivity, DiagnosticLogs, Preferences } from "../../ui-shared/protocol";

export { CoreError };

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
  return parseEnvelope<Payload>(kind, expect, raw);
}

export const core = {
  status: () => send<CoreStatus>("status.get", "status"),
  refreshRemotes: () => send<readonly CoreRemote[]>("remote.refresh", "remotes"),
  addRemote: (name: string) => send<unknown>("remote.add", "remotes", { name }),
  removeRemote: (name: string) => send<unknown>("remote.remove", "remotes", { name }),
  renameDevice: (name: string) => send<{ deviceName?: string }>("device.update", "status", { name }),

  upsertService: (service: { id: string; name: string; url: string; adapter: string; protocol: "http" | "tcp"; preset: string; shared: boolean; authLog?: string }) =>
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
