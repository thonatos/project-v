/**
 * The one control client both apps use. The transport is injected: macOS pipes
 * to the helper process, iOS calls the C ABI, and neither choice belongs in
 * shared code.
 *
 * The method table mirrors control protocol v1. A platform entry point decides
 * which methods its UI calls; it never re-implements request/response handling.
 */
import { CoreError, parseEnvelope } from './envelope.ts';
import type {
  CoreRemote,
  CoreStatus,
  DiagnosticActivity,
  DiagnosticLogs,
  Preferences,
  ServiceUpsert,
  SharingSelection,
} from './protocol.ts';

/** What a host provides: one request, one raw protocol line back. */
export interface CoreTransport {
  request(kind: string, payload: string): Promise<string>;
}

export interface CoreClient {
  status(): Promise<CoreStatus>;
  refreshRemotes(): Promise<readonly CoreRemote[]>;
  addRemote(name: string): Promise<unknown>;
  removeRemote(name: string): Promise<unknown>;
  renameDevice(name: string): Promise<{ deviceName?: string }>;
  upsertService(service: ServiceUpsert): Promise<unknown>;
  removeService(id: string): Promise<unknown>;
  openMapping(device: string, service: string): Promise<{ url?: string; message?: string }>;
  closeMapping(device: string, service: string): Promise<unknown>;
  startAuth(): Promise<{ authUrl?: string }>;
  reconnect(): Promise<{ state?: string }>;
  logout(): Promise<unknown>;
  updateSharing(sharing: SharingSelection): Promise<unknown>;
  updatePreferences(preferences: Preferences): Promise<unknown>;
  logs(): Promise<DiagnosticLogs>;
  activity(): Promise<DiagnosticActivity>;
}

/**
 * Sends one request and returns its payload, asserting the response type so a
 * mismatched envelope fails here rather than surfacing as a missing field.
 */
async function send<Payload>(
  transport: CoreTransport,
  kind: string,
  expect: string,
  body: unknown = {},
): Promise<Payload> {
  let raw: string;
  try {
    raw = await transport.request(kind, JSON.stringify(body));
  } catch (error) {
    throw new CoreError(String(error));
  }
  return parseEnvelope<Payload>(kind, expect, raw);
}

export function createCoreClient(transport: CoreTransport): CoreClient {
  return {
    status: () => send<CoreStatus>(transport, 'status.get', 'status'),
    refreshRemotes: () => send<readonly CoreRemote[]>(transport, 'remote.refresh', 'remotes'),
    addRemote: (name: string) => send<unknown>(transport, 'remote.add', 'remotes', { name }),
    removeRemote: (name: string) => send<unknown>(transport, 'remote.remove', 'remotes', { name }),
    renameDevice: (name: string) => send<{ deviceName?: string }>(transport, 'device.update', 'status', { name }),

    upsertService: (service: ServiceUpsert) => send<unknown>(transport, 'service.upsert', 'services', service),
    removeService: (id: string) => send<unknown>(transport, 'service.remove', 'services', { id }),

    openMapping: (device: string, service: string) =>
      send<{ url?: string; message?: string }>(transport, 'mapping.open', 'mapping', { device, service }),
    closeMapping: (device: string, service: string) =>
      send<unknown>(transport, 'mapping.close', 'mapping', { device, service }),

    startAuth: () => send<{ authUrl?: string }>(transport, 'auth.start', 'auth.url'),
    reconnect: () => send<{ state?: string }>(transport, 'auth.reconnect', 'status'),
    logout: () => send<unknown>(transport, 'auth.logout', 'status'),

    updateSharing: (sharing: SharingSelection) => send<unknown>(transport, 'sharing.update', 'sharing', sharing),
    updatePreferences: (preferences: Preferences) =>
      send<unknown>(transport, 'preferences.update', 'preferences', preferences),

    logs: () => send<DiagnosticLogs>(transport, 'diagnostics.logs', 'diagnostics.logs'),
    activity: () => send<DiagnosticActivity>(transport, 'diagnostics.activity', 'diagnostics.activity'),
  };
}
