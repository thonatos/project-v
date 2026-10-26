/**
 * Core payload types shared by the desktop and iOS clients.
 *
 * The two hosts run the same Go Core; only the capabilities differ. Fields the
 * access-only iOS Core does not return (`sharing`, local `services`) are
 * optional so both status shapes decode into one type.
 */
import type { DeviceViewModel, DSHAuthLink, ServiceProtocol, ServiceViewModel } from './model.ts';

export interface CoreRemoteService {
  readonly id: string;
  readonly name: string;
  readonly protocol?: ServiceProtocol;
  readonly preset?: string;
  readonly port: number;
  readonly path?: string;
  readonly adapter?: string;
  readonly available: boolean;
}

export interface CoreRemote {
  readonly name: string;
  readonly privateName: string;
  readonly ips?: readonly string[];
  readonly lastConnectedUtc?: string;
  readonly connection?: DeviceViewModel['connection'];
  readonly compatible?: boolean;
  readonly issue?: DeviceViewModel['issue'];
  readonly services?: readonly CoreRemoteService[];
}

export interface CoreLocalService {
  readonly id: string;
  readonly name: string;
  readonly protocol?: ServiceProtocol;
  readonly preset?: string;
  readonly url: string;
  readonly port: number;
  readonly adapter?: string;
  readonly authLog?: string;
  readonly authLink?: DSHAuthLink;
  readonly state: ServiceViewModel['state'];
  readonly shared: boolean;
}

export interface SharingSelection {
  readonly enabled: boolean;
  readonly opencode: boolean;
  readonly dsh: boolean;
}

/** One `service.upsert` request. `authLog` is optional so a sharing toggle keeps it. */
export interface ServiceUpsert {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly adapter: string;
  readonly protocol: ServiceProtocol;
  readonly preset: string;
  readonly shared: boolean;
  readonly authLog?: string;
}

export interface SigningInfo {
  /** The development profile's expiry, as an ISO 8601 string when known. */
  readonly expiresAt?: string;
}

export interface CoreStatus {
  readonly network: DeviceViewModel['connection'];
  readonly deviceName: string;
  readonly preferences?: Preferences;
  readonly tailscale: TailnetDevice;
  readonly tailnetDevices: readonly TailnetDevice[];
  /** Desktop only. */
  readonly sharing?: SharingSelection;
  /** Desktop only. */
  readonly services?: readonly CoreLocalService[];
  readonly remotes: readonly CoreRemote[];
  /** iOS only. */
  readonly signing?: SigningInfo;
  /** Present when Gravatar is enabled and Core has an email identity. */
  readonly avatarUrl?: string;
}

export interface Preferences {
  readonly appearance: 'system' | 'light' | 'dark';
  readonly performanceHud: boolean;
  readonly verboseLogs: boolean;
  readonly gravatarAvatar: boolean;
  readonly tailscaleProxy: boolean;
}

export interface DiagnosticEntry {
  readonly atUtc: string;
  readonly level: string;
  readonly area: string;
  readonly message: string;
}

export interface DiagnosticLogs {
  readonly entries: readonly DiagnosticEntry[];
}

export interface DiagnosticActivity {
  readonly mappings: readonly {
    readonly device: string;
    readonly privateName: string;
    readonly service: string;
    readonly url: string;
    readonly connections: number;
  }[];
  readonly published: Readonly<Record<string, boolean>>;
}

export interface TailnetDevice {
  readonly name: string;
  readonly dnsName?: string;
  readonly ips: readonly string[];
  readonly user?: string;
  readonly tailnet?: string;
  readonly backend?: string;
  readonly online: boolean;
  readonly exitNode?: boolean;
  readonly keyExpired?: boolean;
}
