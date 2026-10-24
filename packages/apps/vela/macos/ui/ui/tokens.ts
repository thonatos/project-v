/**
 * Semantic class tokens, in the spirit of shadcn/ui: every surface is paired
 * with the foreground that is legible on it, and components compose these
 * names instead of literal colors.
 *
 * NSH resolves Tailwind colors to a single value, so a `dark:` counterpart
 * cannot live in the theme itself. Pairing both schemes here is what keeps hex
 * values and `dark:` variants out of every other file.
 */
export const surfaces = {
  canvas: 'bg-canvas text-canvas-foreground dark:bg-dk-canvas dark:text-dk-canvas-foreground',
  surface: 'bg-surface text-surface-foreground dark:bg-dk-surface dark:text-dk-surface-foreground',
  sidebar: 'bg-sidebar text-sidebar-foreground dark:bg-dk-sidebar dark:text-dk-sidebar-foreground',
  subtle: 'bg-subtle text-subtle-foreground dark:bg-dk-subtle dark:text-dk-subtle-foreground',
  accent: 'bg-accent text-accent-foreground dark:bg-dk-accent dark:text-dk-accent-foreground',
  selected: 'bg-subtle dark:bg-dk-subtle',
  /** A recessed well for values the user reads or copies, like an address. */
  well: 'bg-subtle border-line dark:bg-dk-subtle dark:border-dk-line',
  /** The modal veil over the content area: 25% of the text color, so it dims in both appearances. */
  veil: 'bg-surface-foreground/25 dark:bg-dk-surface-foreground/25',
} as const;

export const text = {
  primary: 'text-surface-foreground dark:text-dk-surface-foreground',
  muted: 'text-subtle-foreground dark:text-dk-subtle-foreground',
  accent: 'text-accent dark:text-dk-accent',
  onAccent: 'text-accent-foreground dark:text-dk-accent-foreground',
  success: 'text-success dark:text-dk-success',
  warning: 'text-warning dark:text-dk-warning',
  danger: 'text-danger dark:text-dk-danger',
  offline: 'text-offline dark:text-dk-offline',
  onSidebar: 'text-sidebar-foreground dark:text-dk-sidebar-foreground',
  onSidebarMuted: 'text-sidebar-subtle dark:text-dk-sidebar-subtle',
} as const;

export const edges = {
  line: 'border-line dark:border-dk-line',
  top: 'border-t border-line dark:border-dk-line',
  bottom: 'border-b border-line dark:border-dk-line',
  all: 'border border-line dark:border-dk-line',
  accent: 'border-accent dark:border-dk-accent',
} as const;

export const states = {
  hover: 'active:bg-hover dark:active:bg-dk-hover',
  focus: 'focus:border-focus dark:focus:border-dk-focus',
  disabled: 'disabled:opacity-50',
  placeholder: 'placeholder:text-subtle-foreground dark:placeholder:text-dk-subtle-foreground',
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
  success: 'bg-success dark:bg-dk-success',
  warning: 'bg-warning dark:bg-dk-warning',
  danger: 'bg-danger dark:bg-dk-danger',
  offline: 'bg-offline dark:bg-dk-offline',
  accent: 'bg-accent dark:bg-dk-accent',
  track: 'bg-track dark:bg-dk-track',
} as const;

/**
 * Alert tones. Each pairs a tinted surface with ink measured at 4.5:1 or more
 * against it (`tests/theme.test.mjs`).
 */
export const tones = {
  info: {
    surface: 'bg-info-surface dark:bg-dk-info-surface',
    text: 'text-info-foreground dark:text-dk-info-foreground',
    border: 'border-info-foreground/20 dark:border-dk-info-foreground/20',
    symbol: 'info.circle',
  },
  success: {
    surface: 'bg-success-surface dark:bg-dk-success-surface',
    text: 'text-success-surface-foreground dark:text-dk-success-surface-foreground',
    border: 'border-success-surface-foreground/20 dark:border-dk-success-surface-foreground/20',
    symbol: 'checkmark.circle',
  },
  warning: {
    surface: 'bg-warning-surface dark:bg-dk-warning-surface',
    text: 'text-warning-surface-foreground dark:text-dk-warning-surface-foreground',
    border: 'border-warning-surface-foreground/20 dark:border-dk-warning-surface-foreground/20',
    symbol: 'exclamationmark.triangle',
  },
  danger: {
    surface: 'bg-danger-surface dark:bg-dk-danger-surface',
    text: 'text-danger-surface-foreground dark:text-dk-danger-surface-foreground',
    border: 'border-danger-surface-foreground/20 dark:border-dk-danger-surface-foreground/20',
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
