/**
 * Semantic class tokens, in the spirit of shadcn/ui: every surface is paired
 * with the foreground that is legible on it, and components compose these
 * names instead of literal colors.
 *
 * NSH runtime theme tokens carry both appearances and host overrides. These
 * names only compose semantic roles; they never copy concrete colors.
 */
export const surfaces = {
  canvas: 'bg-canvas text-canvas-foreground',
  surface: 'bg-surface text-surface-foreground',
  sidebar: 'bg-sidebar text-sidebar-foreground',
  subtle: 'bg-subtle text-subtle-foreground',
  accent: 'bg-accent text-accent-foreground',
  selected: 'bg-subtle',
  /** A recessed well for values the user reads or copies, like an address. */
  well: 'bg-subtle border-line',
  /** The modal veil over the content area: 25% of the text color, so it dims in both appearances. */
  veil: 'bg-surface-foreground/25',
} as const;

export const text = {
  primary: 'text-surface-foreground',
  muted: 'text-subtle-foreground',
  accent: 'text-accent',
  onAccent: 'text-accent-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  offline: 'text-offline',
  onSidebar: 'text-sidebar-foreground',
  onSidebarMuted: 'text-sidebar-subtle',
} as const;

export const edges = {
  line: 'border-line',
  top: 'border-t border-line',
  bottom: 'border-b border-line',
  all: 'border border-line',
  accent: 'border-accent',
} as const;

export const states = {
  hover: 'active:bg-hover',
  focus: 'focus:border-focus',
  disabled: 'disabled:opacity-50',
  placeholder: 'placeholder:text-subtle-foreground',
} as const;

/** Status colors keyed by the vocabulary the views already speak. */
export const statusText = {
  forwarding: text.success,
  connecting: text.warning,
  stopped: text.offline,
  failed: text.danger,
  connected: text.success,
  offline: text.offline,
  'needs-auth': text.warning,
  available: text.success,
  unavailable: text.danger,
  checking: text.warning,
} as const;

export type StatusKey = keyof typeof statusText;

export const fills = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  offline: 'bg-offline',
  accent: 'bg-accent',
  track: 'bg-track',
} as const;

/**
 * Alert tones. Each pairs a tinted surface with ink measured at 4.5:1 or more
 * against it (`tests/theme.test.mjs`).
 */
export const tones = {
  info: {
    surface: 'bg-info-surface',
    text: 'text-info-foreground',
    border: 'border-info-foreground/20',
    symbol: 'info.circle',
  },
  success: {
    surface: 'bg-success-surface',
    text: 'text-success-surface-foreground',
    border: 'border-success-surface-foreground/20',
    symbol: 'checkmark.circle',
  },
  warning: {
    surface: 'bg-warning-surface',
    text: 'text-warning-surface-foreground',
    border: 'border-warning-surface-foreground/20',
    symbol: 'exclamationmark.triangle',
  },
  danger: {
    surface: 'bg-danger-surface',
    text: 'text-danger-surface-foreground',
    border: 'border-danger-surface-foreground/20',
    symbol: 'xmark.octagon',
  },
} as const;

export type Tone = keyof typeof tones;

/** Log levels reuse the status colors so ERROR reads like a failure everywhere. */
export const levelText = {
  error: text.danger,
  warn: text.warning,
  info: text.muted,
} as const;

/**
 * The spacing rhythm for the fixed 480pt window. Pages and features take these
 * names; only the atoms in this folder spell out padding.
 */
export const spacing = {
  page: 'p-4',
  /** Left inset of the fixed 56pt navigation rail, for layers that belong to the content area. */
  rail: 'pl-14',
  pageGap: 'gap-5',
  sectionGap: 'gap-2',
  stack: 'gap-3',
  inline: 'gap-2',
} as const;

export const type = {
  pageTitle: 'text-title font-semibold',
  sectionTitle: 'text-caption font-semibold tracking-wide',
  label: 'text-label',
  labelStrong: 'text-label font-semibold',
  body: 'text-body',
  caption: 'text-caption',
  micro: 'text-micro',
  mono: 'font-mono text-caption',
} as const;

/** Measured column widths and component floors for the fixed utility window. */
export const geometry = {
  row: 'min-h-[32px]',
  compactControl: 'min-h-[24px]',
  pageHeader: 'min-h-[28px]',
  sheetFooter: 'min-h-[40px]',
  logTime: 'w-[58px]',
  logLevel: 'w-[42px]',
} as const;
