import type { DeviceViewModel, DSHAuthLink, ServiceProtocol, ServiceViewModel } from "./model";
import type {
  CoreRemote,
  CoreStatus,
  DiagnosticActivity,
  DiagnosticLogs,
} from "./protocol";

export type {
  CoreLocalService,
  CoreRemote,
  CoreRemoteService,
  CoreStatus,
  DiagnosticActivity,
  DiagnosticEntry,
  DiagnosticLogs,
  Preferences,
  SigningInfo,
  TailnetDevice,
} from "./protocol";

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
export const DSH_AUTH_LOG_PLACEHOLDER: string;
export function dshAuthLogHint(authLog: string | undefined, authLink: DSHAuthLink | undefined): string;
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

export function signedIn(status: CoreStatus | null): boolean;
export function userLabel(status: CoreStatus | null): string;
export function userInitial(status: CoreStatus | null): string;
export function isRecentService(
  last: { readonly device: string; readonly service: string } | null,
  device: DeviceViewModel,
  service: ServiceViewModel,
): boolean;
export function serviceKindLabel(service: ServiceViewModel, recent?: boolean): string;
export interface ServiceBadgeView {
  readonly status: DeviceViewModel["connection"] | ServiceViewModel["state"] | "unavailable";
  readonly label: string;
  readonly disabled: boolean;
}
export function serviceBadge(device: DeviceViewModel, service: ServiceViewModel): ServiceBadgeView;
export function groupServicesByDevice(
  devices: readonly DeviceViewModel[],
  last?: { readonly device: string; readonly service: string } | null,
): { readonly device: DeviceViewModel; readonly services: ServiceViewModel[] }[];
