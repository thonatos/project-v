import type { DeviceViewModel, ServiceProtocol, ServiceViewModel } from "./model";

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
  readonly connection?: DeviceViewModel["connection"];
  readonly compatible?: boolean;
  readonly issue?: DeviceViewModel["issue"];
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
  readonly state: ServiceViewModel["state"];
  readonly shared: boolean;
}

export interface CoreStatus {
  readonly network: DeviceViewModel["connection"];
  readonly deviceName: string;
  readonly preferences?: Preferences;
  readonly tailscale: TailnetDevice;
  readonly tailnetDevices: readonly TailnetDevice[];
  readonly sharing: { readonly enabled: boolean; readonly opencode: boolean; readonly dsh: boolean };
  readonly services: readonly CoreLocalService[];
  readonly remotes: readonly CoreRemote[];
}

export interface Preferences {
  readonly appearance: "system" | "light" | "dark";
  readonly performanceHud: boolean;
  readonly verboseLogs: boolean;
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
  readonly mappings: readonly { readonly device: string; readonly privateName: string; readonly service: string; readonly url: string; readonly connections: number }[];
  readonly published: Readonly<Record<string, boolean>>;
}

export interface TailnetDevice { readonly name: string; readonly dnsName?: string; readonly ips: readonly string[]; readonly user?: string; readonly tailnet?: string; readonly backend?: string; readonly online: boolean; readonly exitNode?: boolean; readonly keyExpired?: boolean }

export type PresetGroup = "web" | "tcp";
export type PresetValue = "opencode" | "dsh" | "comfyui" | "custom-http" | "ssh" | "redis" | "mysql" | "postgres" | "custom-tcp";
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
export interface PresetOption { readonly value: PresetValue; readonly label: string; readonly detail: string; readonly disabled: boolean }
export interface Row { readonly key: string; readonly title: string; readonly detail: string }

export const SERVICE_PRESETS: readonly ServicePreset[];
export function protocolOf(service: { readonly protocol?: string } | null | undefined): ServiceProtocol;
export function targetLabel(protocol: ServiceProtocol, url: string | undefined): string;
export function localServices(status: CoreStatus): ServiceViewModel[];
export function remoteDevices(remotes: readonly CoreRemote[]): DeviceViewModel[];
export function presetOptions(group: PresetGroup, services: readonly ServiceViewModel[]): PresetOption[];
export function presetFor(value: string): ServicePreset;
export function presetForService(service: ServiceViewModel | undefined): PresetValue;
export function serviceFormError(protocol: ServiceProtocol, name: string, target: string): string;
export function serviceTargetURL(protocol: ServiceProtocol, target: string): string;
export function forwardEndpoint(url: string): { protocol: ServiceProtocol; host: string; port: number };
export function connectionCommand(preset: string | undefined, url: string): string;
export function shareWarning(service: ServiceViewModel): { title: string; message: string };
export function diagnosticSnapshot(status: CoreStatus, protocolVersion: string): string;
export function connectionLabel(state: DeviceViewModel["connection"]): string;
export function diagnosticSummaryRows(status: CoreStatus | null, protocolVersion: string): Row[];
export function nextDeviceID(selected: string, remoteIDs: readonly string[], direction: -1 | 1): string;
export function remoteAddError(detail: string): string;
export function serviceStateLabel(service: ServiceViewModel): string;
export function dshMappingURL(mappingURL: string, authenticationURL: string): string;
export function appearancePreference(status: CoreStatus | null): "system" | "light" | "dark";
export function diagnosticActivityRows(activity: DiagnosticActivity | null): Row[];
export function deviceAddressLines(ips: readonly string[] | undefined): string[];

export type LogLevel = "error" | "warn" | "info";
export interface LogRowModel {
  readonly key: string;
  readonly time: string;
  readonly level: LogLevel;
  readonly levelLabel: string;
  readonly area: string;
  readonly message: string;
}
export function logRows(logs: DiagnosticLogs | null, level?: LogLevel | "all"): LogRowModel[];
export function logLevelCounts(logs: DiagnosticLogs | null): Record<"all" | LogLevel, number>;
